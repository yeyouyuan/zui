/* global AbortSignal, fetch, structuredClone */
import http from 'node:http';
import { Buffer } from 'node:buffer';
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, open, readFile, rename, readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL, URL } from 'node:url';

const TYPES = {
  docx: ['word', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xlsx: ['cell', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  pdf: ['pdf', 'application/pdf'],
};
const SESSION_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const CAPABILITY = /^[A-Za-z0-9_-]{43}$/;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const capability = () => randomBytes(32).toString('base64url');
const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const hasControl = (value) => [...value].some((character) => character.charCodeAt(0) < 32);
const invalidFilename = (value) => value.includes('/') || value.includes('\\') || hasControl(value);
const equal = (a, b) => {
  const left = Buffer.from(String(a ?? ''));
  const right = Buffer.from(String(b ?? ''));
  return left.length === right.length && timingSafeEqual(left, right);
};
class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function signJwt(payload, secret, lifetime = 300) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + lifetime })).toString(
    'base64url'
  );
  const unsigned = `${header}.${body}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

export function verifyJwt(token, secret) {
  if (typeof token !== 'string' || token.length > 65536) throw new RequestError(401, 'JWT 无效。');
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part)))
    throw new RequestError(401, 'JWT 无效。');
  let header, claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw new RequestError(401, 'JWT 无效。');
  }
  const signature = createHmac('sha256', secret)
    .update(`${parts[0]}.${parts[1]}`)
    .digest('base64url');
  const now = Math.floor(Date.now() / 1000);
  if (
    !isObject(header) ||
    header.alg !== 'HS256' ||
    !isObject(claims) ||
    !equal(parts[2], signature) ||
    (claims.exp !== undefined && (!Number.isFinite(claims.exp) || claims.exp <= now)) ||
    (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now))
  )
    throw new RequestError(401, 'JWT 签名或有效期无效。');
  return claims;
}

async function atomicWrite(filename, bytes) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  const handle = await open(temporary, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, filename);
}

function readBody(request, limit) {
  return new Promise((resolveBody, reject) => {
    let length = 0;
    let failed = false;
    const chunks = [];
    request.on('data', (chunk) => {
      if (failed) return;
      length += chunk.length;
      if (length > limit) {
        failed = true;
        chunks.length = 0;
        reject(new RequestError(413, '文件或请求内容超过容量上限。'));
      } else chunks.push(chunk);
    });
    request.on('end', () => {
      if (!failed) resolveBody(Buffer.concat(chunks));
    });
    request.on('error', reject);
    request.on('aborted', () => reject(new RequestError(400, '文件上传已中断。')));
  });
}
async function jsonBody(request, limit = 256 * 1024) {
  try {
    const value = JSON.parse((await readBody(request, limit)).toString('utf8'));
    if (!isObject(value)) throw new Error();
    return value;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(400, 'JSON 请求格式无效。');
  }
}
function json(response, status, value) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(value));
}
function localhostOrigin(value) {
  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
function fileHeader(bytes, type) {
  return type === 'pdf'
    ? /%PDF-\d\.\d/.test(bytes.subarray(0, 1024).toString('latin1'))
    : bytes.length >= 4 &&
        bytes[0] === 80 &&
        bytes[1] === 75 &&
        ((bytes[2] === 3 && bytes[3] === 4) || (bytes[2] === 5 && bytes[3] === 6));
}
function required(value, name, max = 200) {
  if (typeof value !== 'string' || !value || value.length > max || hasControl(value))
    throw new RequestError(400, `${name} 无效。`);
  return value;
}

export async function createOfficeBridge(options = {}) {
  const secret = options.jwtSecret ?? process.env.JWT_SECRET;
  if (typeof secret !== 'string' || secret.length < 16)
    throw new Error('JWT_SECRET 必须设置为至少 16 个字符，并与 DocumentServer 一致。');
  const dataDir = resolve(options.dataDir ?? process.env.OFFICE_DATA_DIR ?? './.office-data');
  const internal = new URL(
    options.documentServerInternalUrl ??
      process.env.DOCSERVER_INTERNAL_URL ??
      'http://documentserver'
  );
  const publicServer = new URL(
    options.documentServerUrl ?? process.env.DOCSERVER_PUBLIC_URL ?? 'http://127.0.0.1:8082'
  );
  const bridge = new URL(
    options.bridgeInternalUrl ?? process.env.BRIDGE_INTERNAL_URL ?? 'http://bridge:8790'
  );
  const maxFileBytes = options.maxFileBytes ?? 20 * 1024 * 1024;
  const fetchTimeoutMs = options.fetchTimeoutMs ?? 30000;
  for (const url of [internal, publicServer, bridge])
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw new Error('Office 服务地址无效。');
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  const sessions = new Map();
  const queues = new Map();
  const forceRequests = new Map();
  for (const entry of await readdir(dataDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !SESSION_ID.test(entry.name)) continue;
    try {
      const session = JSON.parse(
        await readFile(join(dataDir, entry.name, 'manifest.json'), 'utf8')
      );
      if (
        !isObject(session) ||
        session.schema !== 1 ||
        session.id !== entry.name ||
        !Object.hasOwn(TYPES, session.fileType) ||
        typeof session.name !== 'string' ||
        invalidFilename(session.name) ||
        session.name.length > 180 ||
        typeof session.workspaceId !== 'string' ||
        typeof session.fileId !== 'string' ||
        !['edit', 'view'].includes(session.mode) ||
        !SHA256.test(session.key) ||
        !SHA256.test(session.accessTokenHash) ||
        !CAPABILITY.test(session.sourceCap) ||
        !CAPABILITY.test(session.callbackCap) ||
        !SHA256.test(session.sourceHash) ||
        !Number.isSafeInteger(session.baseRevision) ||
        session.baseRevision < 1 ||
        !Number.isSafeInteger(session.ackRevision) ||
        session.ackRevision < session.baseRevision ||
        !Number.isSafeInteger(session.sequence) ||
        session.sequence < 0 ||
        !Number.isSafeInteger(session.ackSequence) ||
        session.ackSequence < 0 ||
        session.ackSequence > session.sequence ||
        !Array.isArray(session.results) ||
        !Array.isArray(session.callbacks) ||
        !Array.isArray(session.commands) ||
        session.callbacks.some(
          (fingerprint) => typeof fingerprint !== 'string' || !SHA256.test(fingerprint)
        ) ||
        session.commands.some(
          (command) =>
            !isObject(command) ||
            !SESSION_ID.test(command.id) ||
            !Number.isSafeInteger(command.order) ||
            command.order < 1
        ) ||
        session.results.some(
          (result) =>
            !isObject(result) ||
            !Number.isSafeInteger(result.sequence) ||
            result.sequence < 1 ||
            result.sequence > session.sequence ||
            !SHA256.test(result.hash) ||
            !Number.isSafeInteger(result.size) ||
            result.size < 0 ||
            ![
              `result-${result.sequence}.${session.fileType}`,
              `result-${result.sequence}-${result.hash}.${session.fileType}`,
            ].includes(result.filename) ||
            (result.requestId !== undefined && !SESSION_ID.test(result.requestId))
        ) ||
        (session.sequence > 0 &&
          !session.results.some((result) => result.sequence === session.sequence))
      )
        continue;
      session.pendingCommandId ??=
        session.state === 'saving' ? (session.commands.at(-1)?.id ?? null) : null;
      for (const command of session.commands)
        command.state ??= command.id === session.pendingCommandId ? 'accepted' : 'saved';
      session.acceptedCommandOrder = Number.isSafeInteger(session.acceptedCommandOrder)
        ? session.acceptedCommandOrder
        : 0;
      session.lastResultTime = Number.isFinite(session.lastResultTime) ? session.lastResultTime : 0;
      sessions.set(session.id, session);
    } catch {
      /* Keep unreadable records and their files intact for manual recovery. */
    }
  }
  const folder = (session) => join(dataDir, session.id);
  const save = async (session) => {
    session.updatedAt = new Date().toISOString();
    await atomicWrite(join(folder(session), 'manifest.json'), JSON.stringify(session));
  };
  const commit = async (session, update) => {
    const next = structuredClone(session);
    update(next);
    await save(next);
    Object.assign(session, next);
  };
  const serial = (id, action) => {
    const next = (queues.get(id) ?? Promise.resolve()).catch(() => {}).then(action);
    queues.set(id, next);
    void next
      .finally(() => {
        if (queues.get(id) === next) queues.delete(id);
      })
      .catch(() => {});
    return next;
  };
  const getSession = (id) => {
    if (!SESSION_ID.test(id)) throw new RequestError(404, '编辑会话不存在。');
    const session = sessions.get(id);
    if (!session) throw new RequestError(404, '编辑会话不存在。');
    return session;
  };
  function editorConfig(session) {
    const editable = session.mode === 'edit';
    const config = {
      document: {
        fileType: session.fileType,
        key: session.key,
        title: session.name,
        url: `${bridge.origin}/internal/office/source/${session.id}?cap=${session.sourceCap}`,
        ...(session.fileType === 'pdf' ? { isForm: false } : {}),
        permissions: {
          edit: editable,
          download: true,
          print: true,
          comment: editable,
          review: editable,
        },
      },
      documentType: TYPES[session.fileType][0],
      type: 'desktop',
      width: '100%',
      height: '100%',
      editorConfig: {
        mode: session.mode,
        lang: 'zh-CN',
        callbackUrl: `${bridge.origin}/internal/office/callback/${session.id}?cap=${session.callbackCap}`,
        user: { id: session.workspaceId, name: '本机用户' },
        customization: { autosave: true, forcesave: true, compactToolbar: false },
      },
    };
    return { ...config, token: signJwt(config, secret, 6 * 60 * 60) };
  }
  function state(session) {
    const latest = session.results.find((result) => result.sequence === session.sequence);
    return {
      id: session.id,
      key: session.key,
      fileId: session.fileId,
      workspaceId: session.workspaceId,
      mode: session.mode,
      baseRevision: session.baseRevision,
      ackRevision: session.ackRevision,
      sequence: session.sequence,
      ackSequence: session.ackSequence,
      state: session.state,
      error: session.error,
      config: editorConfig(session),
      ...(latest
        ? {
            result: {
              sequence: latest.sequence,
              size: latest.size,
              hash: latest.hash,
              ...(latest.requestId ? { requestId: latest.requestId } : {}),
            },
          }
        : {}),
    };
  }
  function sessionAuth(request, session) {
    const token = request.headers['x-office-session-token'];
    if (typeof token !== 'string' || !equal(hash(token), session.accessTokenHash))
      throw new RequestError(401, '编辑会话凭据无效。');
  }
  function checkedDownloadUrl(value) {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new RequestError(400, '文档服务返回的文件地址无效。');
    }
    if (
      url.username ||
      url.password ||
      ![internal.origin, publicServer.origin].includes(url.origin)
    )
      throw new RequestError(400, '仅允许下载配置的文档服务文件。');
    if (url.origin === publicServer.origin) {
      url.protocol = internal.protocol;
      url.host = internal.host;
      url.port = internal.port;
    }
    url.hash = '';
    return url;
  }
  async function generatedFile(value) {
    let url = checkedDownloadUrl(value);
    for (let redirects = 0; redirects <= 3; redirects++) {
      const token = signJwt({ url: url.href, operation: 'download' }, secret);
      const response = await fetch(url, {
        redirect: 'manual',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(fetchTimeoutMs),
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location || redirects === 3) throw new RequestError(502, '文档文件重定向无效。');
        url = checkedDownloadUrl(new URL(location, url).href);
        continue;
      }
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new RequestError(502, '无法读取文档服务生成的文件。');
      }
      if (Number(response.headers.get('content-length')) > maxFileBytes) {
        await response.body.cancel();
        throw new RequestError(413, '生成文件超过单文件容量上限，原件已保留。');
      }
      let size = 0;
      const chunks = [];
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > maxFileBytes)
          throw new RequestError(413, '生成文件超过单文件容量上限，原件已保留。');
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }
    throw new RequestError(502, '文档文件重定向过多。');
  }
  async function streamFile(response, session, filename) {
    const location = join(folder(session), filename);
    const details = await stat(location);
    response.writeHead(200, {
      'Content-Type': TYPES[session.fileType][1],
      'Content-Length': details.size,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(session.name)}`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    const stream = createReadStream(location);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  }
  async function callback(request, response, url, id) {
    const session = getSession(id);
    if (!equal(url.searchParams.get('cap'), session.callbackCap))
      throw new RequestError(401, '回写凭据无效。');
    const raw = await jsonBody(request);
    const authorization = request.headers.authorization;
    const token =
      raw.token ??
      (typeof authorization === 'string' ? /^Bearer\s+(.+)$/i.exec(authorization)?.[1] : undefined);
    const claims = verifyJwt(token, secret);
    if (claims.operation !== undefined && claims.operation !== 'callback')
      throw new RequestError(401, 'JWT 用途无效。');
    const body = isObject(claims.payload) ? claims.payload : claims;
    if (body.key !== session.key || !Number.isSafeInteger(body.status))
      throw new RequestError(401, '回写文件标识或状态无效。');
    for (const field of ['key', 'status', 'url', 'userdata', 'forcesavetime', 'lastsave'])
      if (raw[field] !== undefined && JSON.stringify(raw[field]) !== JSON.stringify(body[field]))
        throw new RequestError(401, '回写内容与签名不一致。');
    if (session.mode !== 'edit' && [2, 6].includes(body.status))
      throw new RequestError(403, '只读会话禁止回写文件。');
    await serial(id, async () => {
      if (session.state === 'closed' && [1, 6].includes(body.status)) return;
      const command = session.commands.find((operation) => operation.id === body.userdata);
      const order = command?.order;
      if (order !== undefined && order < session.acceptedCommandOrder) return;
      if ([3, 7].includes(body.status)) {
        await commit(session, (next) => {
          next.state = 'error';
          next.error = `文档服务保存失败（状态 ${body.status}），原件与已生成版本已保留。`;
          const failed = next.commands.find(
            (operation) => operation.id === (command?.id ?? next.pendingCommandId)
          );
          if (failed) {
            failed.state = 'failed';
            failed.error = next.error;
          }
          if (!command || next.pendingCommandId === command.id) next.pendingCommandId = null;
        });
        return;
      }
      if (![1, 2, 4, 6].includes(body.status)) throw new RequestError(400, '不支持此回写状态。');
      if (body.status === 1 || body.status === 4) {
        await commit(session, (next) => {
          if (body.status === 4) {
            const pending = next.commands.find(
              (operation) => operation.id === next.pendingCommandId
            );
            if (pending) pending.state = 'closed';
            next.pendingCommandId = null;
            next.state = 'closed';
          } else {
            next.state = next.pendingCommandId ? 'saving' : 'editing';
            next.error = '';
          }
        });
        return;
      }
      const fingerprint = hash(
        JSON.stringify([body.status, body.url, body.userdata, body.forcesavetime, body.lastsave])
      );
      if (session.callbacks.includes(fingerprint)) return;
      const rawTime =
        typeof body.forcesavetime === 'number'
          ? body.forcesavetime
          : typeof body.lastsave === 'number'
            ? body.lastsave
            : typeof body.lastsave === 'string'
              ? Date.parse(body.lastsave)
              : undefined;
      const timestamp = Number.isFinite(rawTime) && rawTime < 1e12 ? rawTime * 1000 : rawTime;
      if (Number.isFinite(timestamp) && timestamp < session.lastResultTime) return;
      try {
        const bytes = await generatedFile(body.url);
        if (!fileHeader(bytes, session.fileType))
          throw new RequestError(502, '生成文件格式无效，原件和先前版本已保留。');
        const digest = hash(bytes);
        const previous = session.results.find((result) => result.sequence === session.sequence);
        const requestId =
          typeof body.userdata === 'string' && SESSION_ID.test(body.userdata)
            ? body.userdata
            : undefined;
        let result;
        if (!previous || previous.hash !== digest) {
          const sequence = session.sequence + 1;
          const filename = `result-${sequence}-${digest}.${session.fileType}`;
          await atomicWrite(join(folder(session), filename), bytes);
          result = {
            sequence,
            hash: digest,
            size: bytes.length,
            filename,
            createdAt: new Date().toISOString(),
            ...(requestId ? { requestId } : {}),
          };
        }
        await commit(session, (next) => {
          if (result) {
            next.results.push(result);
            next.sequence = result.sequence;
          } else if (requestId)
            next.results.find((entry) => entry.sequence === next.sequence).requestId = requestId;
          next.callbacks.push(fingerprint);
          if (order !== undefined)
            next.acceptedCommandOrder = Math.max(next.acceptedCommandOrder, order);
          if (Number.isFinite(timestamp)) next.lastResultTime = timestamp;
          if (command)
            next.commands.find((operation) => operation.id === command.id).state = 'saved';
          if (requestId === next.pendingCommandId) next.pendingCommandId = null;
          if (body.status === 2) {
            const pending = next.commands.find(
              (operation) => operation.id === next.pendingCommandId
            );
            if (pending) pending.state = 'closed';
            next.pendingCommandId = null;
            next.state = 'closed';
          } else next.state = next.pendingCommandId ? 'saving' : 'saved';
          next.error = '';
        });
      } catch (error) {
        await commit(session, (next) => {
          next.state = 'error';
          next.error =
            error instanceof RequestError
              ? error.message
              : '生成文件暂时无法读取，原件与已保存版本已保留。';
          if (command) {
            const failed = next.commands.find((operation) => operation.id === command.id);
            failed.state = 'failed';
            failed.error = next.error;
            if (next.pendingCommandId === command.id) next.pendingCommandId = null;
          }
        });
        throw error;
      }
    });
    json(response, 200, { error: 0 });
  }
  function forceResponse(session, command) {
    if (command.state === 'closed')
      throw new RequestError(409, '编辑会话已结束，请重新打开文件后保存。');
    const noChanges = command.state === 'no-changes';
    return {
      accepted: !noChanges,
      noChanges,
      sequence: session.sequence,
      forceSaveId: command.id,
      requestId: command.id,
    };
  }
  async function executeForceSave(session, requestId) {
    const command = await serial(session.id, async () => {
      if (session.mode !== 'edit') throw new RequestError(403, '只读会话不能保存修改。');
      const previous = session.commands.find((operation) => operation.id === requestId);
      if (previous?.state === 'failed')
        throw new RequestError(502, previous.error ?? '此保存操作已失败，请使用新的请求标识重试。');
      if (previous) return previous;
      if (session.state === 'closed')
        throw new RequestError(409, '编辑会话已结束，请重新打开文件后保存。');
      if (session.pendingCommandId)
        throw new RequestError(409, '上一次保存尚在处理，请等待回写结果。');
      const operation = { id: requestId, order: session.commands.length + 1, state: 'submitting' };
      await commit(session, (next) => {
        next.commands.push(operation);
        next.pendingCommandId = operation.id;
        next.state = 'saving';
        next.error = '';
      });
      return operation;
    });
    if (command.state !== 'submitting') return forceResponse(session, command);
    try {
      const payload = {
        c: 'forcesave',
        key: session.key,
        userdata: command.id,
        operation: 'command',
      };
      const token = signJwt(payload, secret);
      const response = await fetch(new URL('/command', internal), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ c: payload.c, key: payload.key, userdata: payload.userdata, token }),
        signal: AbortSignal.timeout(fetchTimeoutMs),
      });
      if (!response.ok) throw new RequestError(502, '文档服务未接受保存命令。');
      const result = await response.json();
      if (!isObject(result) || !Number.isSafeInteger(result.error))
        throw new RequestError(502, '文档服务保存响应无效。');
      if (![0, 4].includes(result.error))
        throw new RequestError(502, `文档服务保存命令失败（错误 ${result.error}）。`);
      await serial(session.id, async () => {
        const current = session.commands.find((operation) => operation.id === command.id);
        if (current.state !== 'submitting') return;
        await commit(session, (next) => {
          next.commands.find((operation) => operation.id === command.id).state =
            result.error === 4 ? 'no-changes' : 'accepted';
          if (result.error === 4 && next.pendingCommandId === command.id) {
            next.pendingCommandId = null;
            next.state = next.sequence ? 'saved' : 'editing';
            next.error = '';
          }
        });
      });
      return forceResponse(
        session,
        session.commands.find((operation) => operation.id === command.id)
      );
    } catch (error) {
      let completed = false;
      await serial(session.id, async () => {
        const current = session.commands.find((operation) => operation.id === command.id);
        if (current.state === 'saved') {
          completed = true;
          return;
        }
        if (session.pendingCommandId !== command.id) return;
        await commit(session, (next) => {
          next.pendingCommandId = null;
          next.state = 'error';
          next.error =
            error instanceof RequestError
              ? error.message
              : '保存命令未完成，请重试；文件副本已保留。';
          const failed = next.commands.find((operation) => operation.id === command.id);
          failed.state = 'failed';
          failed.error = next.error;
        });
      });
      if (completed)
        return forceResponse(
          session,
          session.commands.find((operation) => operation.id === command.id)
        );
      throw error instanceof RequestError ? error : new RequestError(502, '无法连接文档保存服务。');
    }
  }
  async function forceSave(session, requestId) {
    if (typeof requestId !== 'string' || !SESSION_ID.test(requestId))
      throw new RequestError(400, '保存请求需要有效的 requestId UUID。');
    const key = `${session.id}:${requestId}`;
    const existing = forceRequests.get(key);
    if (existing) return existing;
    const pending = executeForceSave(session, requestId);
    forceRequests.set(key, pending);
    try {
      return await pending;
    } finally {
      if (forceRequests.get(key) === pending) forceRequests.delete(key);
    }
  }
  let healthCache;
  async function health() {
    if (healthCache && Date.now() - healthCache.time < 1500) return healthCache.value;
    let value;
    try {
      const response = await fetch(new URL('/healthcheck', internal), {
        signal: AbortSignal.timeout(Math.min(fetchTimeoutMs, 2500)),
      });
      if (!response.ok || (await response.text()).trim() !== 'true') throw new Error();
      let version = options.documentServerVersion ?? process.env.DOCSERVER_VERSION ?? null;
      let detectedVersion;
      try {
        const details = await fetch(new URL('/info/info.json', internal), {
          signal: AbortSignal.timeout(Math.min(fetchTimeoutMs, 1000)),
        });
        if (details.ok) {
          const info = await details.json();
          detectedVersion = typeof info.version === 'string' ? info.version : undefined;
        } else await details.body?.cancel();
      } catch {
        /* Health is valid even when optional version metadata is unavailable. */
      }
      if (!detectedVersion) {
        try {
          const payload = { c: 'version', operation: 'command' };
          const token = signJwt(payload, secret);
          const details = await fetch(new URL('/command', internal), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ c: payload.c, token }),
            signal: AbortSignal.timeout(Math.min(fetchTimeoutMs, 1000)),
          });
          if (details.ok) {
            const info = await details.json();
            if (isObject(info) && info.error === 0 && typeof info.version === 'string')
              detectedVersion = info.version;
          } else await details.body?.cancel();
        } catch {
          /* Keep the configured version when the authenticated metadata command is unavailable. */
        }
      }
      version = detectedVersion || version;
      value = { available: true, documentServerUrl: publicServer.origin, version, error: '' };
    } catch {
      value = {
        available: false,
        documentServerUrl: publicServer.origin,
        version: null,
        error: '完整文档编辑服务尚未就绪，请检查本机 Office 服务。',
      };
    }
    healthCache = { time: Date.now(), value };
    return value;
  }
  const server = http.createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://bridge');
      const origin = request.headers.origin;
      const isInternal = url.pathname.startsWith('/internal/office/');
      if (!isInternal) {
        if (origin && !localhostOrigin(origin))
          throw new RequestError(403, '仅允许本机页面访问文件编辑服务。');
        if (origin) {
          response.setHeader('Access-Control-Allow-Origin', origin);
          response.setHeader('Vary', 'Origin');
        }
        if (
          ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(request.method) &&
          !localhostOrigin(origin)
        )
          throw new RequestError(403, '写操作需要本机页面来源。');
      }
      if (request.method === 'OPTIONS' && !isInternal) {
        response.writeHead(204, {
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Office-Session-Token',
        });
        response.end();
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/office/health') {
        json(response, 200, await health());
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/office/sessions') {
        const workspaceId = required(url.searchParams.get('workspaceId'), '工作区标识');
        const fileId = required(url.searchParams.get('fileId'), '文件标识');
        const name = required(url.searchParams.get('name'), '文件名', 180);
        const baseRevision = Number(url.searchParams.get('revision'));
        const mode = url.searchParams.get('mode');
        const fileType = name.split('.').pop().toLowerCase();
        if (
          invalidFilename(name) ||
          !Object.hasOwn(TYPES, fileType) ||
          !Number.isSafeInteger(baseRevision) ||
          baseRevision < 1 ||
          !['edit', 'view'].includes(mode)
        )
          throw new RequestError(400, '文件类型、版本或编辑模式无效。');
        const bytes = await readBody(request, maxFileBytes);
        if (!fileHeader(bytes, fileType)) throw new RequestError(400, '原文件格式无效。');
        const accessToken = capability();
        const session = {
          schema: 1,
          id: randomUUID(),
          workspaceId,
          fileId,
          name,
          fileType,
          baseRevision,
          ackRevision: baseRevision,
          mode,
          key: randomBytes(32).toString('hex'),
          accessTokenHash: hash(accessToken),
          sourceCap: capability(),
          callbackCap: capability(),
          sourceHash: hash(bytes),
          sourceSize: bytes.length,
          sequence: 0,
          ackSequence: 0,
          ackHash: hash(bytes),
          state: 'opening',
          error: '',
          results: [],
          callbacks: [],
          commands: [],
          pendingCommandId: null,
          acceptedCommandOrder: 0,
          lastResultTime: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await mkdir(folder(session), { mode: 0o700 });
        await atomicWrite(join(folder(session), `source.${fileType}`), bytes);
        await save(session);
        sessions.set(session.id, session);
        json(response, 201, {
          id: session.id,
          accessToken,
          config: editorConfig(session),
          sequence: 0,
          key: session.key,
        });
        return;
      }
      const source = /^\/internal\/office\/source\/([^/]+)$/.exec(url.pathname);
      if (source && request.method === 'GET') {
        const session = getSession(source[1]);
        if (!equal(url.searchParams.get('cap'), session.sourceCap))
          throw new RequestError(401, '取件凭据无效。');
        if (request.headers.authorization) {
          const authorization = request.headers.authorization;
          const claims = verifyJwt(
            typeof authorization === 'string'
              ? /^Bearer\s+(.+)$/i.exec(authorization)?.[1]
              : undefined,
            secret
          );
          if (claims.operation !== undefined && claims.operation !== 'download')
            throw new RequestError(401, 'JWT 用途无效。');
        }
        const latest = session.results.find((result) => result.sequence === session.sequence);
        await streamFile(response, session, latest?.filename ?? `source.${session.fileType}`);
        return;
      }
      const cb = /^\/internal\/office\/callback\/([^/]+)$/.exec(url.pathname);
      if (cb && request.method === 'POST') {
        await callback(request, response, url, cb[1]);
        return;
      }
      const route =
        /^\/api\/office\/sessions\/([^/]+)(?:\/(force-save|ack|results\/([1-9]\d*)))?$/.exec(
          url.pathname
        );
      if (route) {
        const session = getSession(route[1]);
        sessionAuth(request, session);
        if (!route[2] && request.method === 'GET') {
          json(response, 200, state(session));
          return;
        }
        if (route[2] === 'force-save' && request.method === 'POST') {
          const body = await jsonBody(request);
          json(response, 200, await forceSave(session, body.requestId));
          return;
        }
        if (route[2] === 'ack' && request.method === 'POST') {
          const ack = await jsonBody(request);
          await serial(session.id, async () => {
            const result = session.results.find((result) => result.sequence === ack.sequence);
            if (
              !result ||
              ack.hash !== result.hash ||
              !Number.isSafeInteger(ack.revision) ||
              ack.revision <= session.baseRevision
            )
              throw new RequestError(409, '保存确认与生成文件不一致。');
            if (ack.sequence < session.ackSequence || ack.revision < session.ackRevision)
              throw new RequestError(409, '不能回退已确认的文件版本。');
            if (ack.sequence === session.ackSequence && ack.revision !== session.ackRevision)
              throw new RequestError(409, '重复确认的文件版本不一致。');
            if (ack.sequence > session.ackSequence && ack.revision <= session.ackRevision)
              throw new RequestError(409, '新生成文件需要更新工作区版本。');
            await commit(session, (next) => {
              next.ackSequence = ack.sequence;
              next.ackRevision = ack.revision;
              next.ackHash = ack.hash;
            });
          });
          json(response, 200, state(session));
          return;
        }
        if (route[3] && request.method === 'GET') {
          const result = session.results.find((result) => result.sequence === Number(route[3]));
          if (!result) throw new RequestError(404, '生成文件不存在。');
          await streamFile(response, session, result.filename);
          return;
        }
        throw new RequestError(405, '此接口不支持该操作。');
      }
      throw new RequestError(404, '接口不存在。');
    })().catch((error) => {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      const status = error instanceof RequestError ? error.status : 500;
      const message =
        error instanceof RequestError
          ? error.message
          : '本机文件服务操作失败；原文件与已生成版本均保留。';
      const isCallback = request.url?.startsWith('/internal/office/callback/');
      json(response, status, isCallback ? { error: 1, message } : { error: message });
    });
  });
  server.requestTimeout = 60000;
  server.headersTimeout = 10000;
  return server;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const server = await createOfficeBridge();
  const port = Number(process.env.PORT ?? 8790);
  const host = process.env.HOST ?? '0.0.0.0';
  server.listen(port, host, () => console.log(`Office bridge listening on ${host}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => server.close(() => process.exit(0)));
}
