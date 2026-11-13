import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  accessSync,
  chmodSync,
  constants,
  existsSync,
  lstatSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { prepareOfficeFonts } from './office-fonts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deployment = path.join(root, 'deploy/office');
const composeFile = path.join(deployment, 'compose.yaml');
const envFile = path.join(deployment, '.env.local');
const profile = 'zui-office';
const context = 'colima-zui-office';
const project = 'zui-office';
const command = process.argv[2] ?? 'status';

function executable(name) {
  const directories = [
    ...(process.env.PATH ?? '').split(path.delimiter),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
  ];
  for (const directory of new Set(directories.filter(Boolean))) {
    const candidate = path.join(directory, name);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Continue searching without changing the user's PATH or tool configuration.
    }
  }
  return undefined;
}

function isolatedEnvironment() {
  const environment = { ...process.env, DOCKER_CONTEXT: context };
  delete environment.DOCKER_HOST;
  delete environment.DOCKER_TLS_VERIFY;
  delete environment.DOCKER_CERT_PATH;
  delete environment.JWT_SECRET;
  return environment;
}

const environment = isolatedEnvironment();

function probe(file, args) {
  return spawnSync(file, args, {
    cwd: root,
    env: environment,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 10000,
  });
}

function run(file, args) {
  const result = spawnSync(file, args, { cwd: root, env: environment, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`文档服务命令执行失败（退出码 ${result.status ?? result.signal}）。`);
  }
}

function initializeSecret() {
  try {
    writeFileSync(envFile, `JWT_SECRET=${randomBytes(32).toString('hex')}\n`, {
      flag: 'wx',
      mode: 0o600,
    });
    console.log('已生成本地文档服务密钥。');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  validateSecret();
}

function validateSecret() {
  if (!lstatSync(envFile).isFile()) {
    throw new Error('文档服务密钥必须保存在常规文件 deploy/office/.env.local 中。');
  }
  const contents = readFileSync(envFile, 'utf8');
  if (!/^JWT_SECRET=[a-f0-9]{64}\r?\n?$/i.test(contents)) {
    throw new Error('deploy/office/.env.local 中的 JWT_SECRET 无效，需要 256 位随机密钥。');
  }
  chmodSync(envFile, 0o600);
}

function composeExecutable(docker) {
  if (probe(docker, ['--context', context, 'compose', 'version']).status === 0) {
    return { file: docker, prefix: ['--context', context, 'compose'] };
  }
  const standalone = executable('docker-compose');
  if (standalone && probe(standalone, ['--context', context, 'version']).status === 0) {
    return { file: standalone, prefix: ['--context', context] };
  }
  throw new Error('找不到 Docker Compose，请安装 Compose 插件或 Homebrew docker-compose。');
}

function composeRunner(binary) {
  return (...args) =>
    run(binary.file, [
      ...binary.prefix,
      '--project-name',
      project,
      '--file',
      composeFile,
      '--env-file',
      envFile,
      ...args,
    ]);
}

function runtimeReady(docker) {
  return (
    probe(docker, ['--context', context, 'info', '--format', '{{.ServerVersion}}']).status === 0
  );
}

function startRuntime(docker) {
  if (runtimeReady(docker)) return;
  const colima = executable('colima');
  if (!colima) {
    throw new Error('专用 Docker context 未就绪，请安装 Colima：brew install colima。');
  }
  const inventory = probe(colima, ['list', '--json']);
  if (inventory.status !== 0) throw new Error('无法读取 Colima profile 列表。');
  const profiles = inventory.stdout
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const existing = profiles.find((entry) => entry.name === profile);
  if (existing && existing.runtime !== 'docker') {
    throw new Error('专用 Colima profile zui-office 已存在，但使用的 runtime 不是 Docker。');
  }
  console.log('正在启动文档服务专用 Colima 运行环境。');
  const args = ['start', profile, '--activate=false'];
  if (!existing) {
    args.push('--runtime', 'docker', '--cpus', '4', '--memory', '4', '--disk', '40');
    if (process.platform === 'darwin') args.push('--vm-type', 'vz');
  }
  run(colima, args);
  if (!runtimeReady(docker)) throw new Error('专用 Docker context 尚未就绪，请稍后重试启动。');
}

async function serviceHealth() {
  const checks = [
    ['文档编辑器', 'http://127.0.0.1:8082/healthcheck'],
    ['文件桥接', 'http://127.0.0.1:8790/api/office/health'],
  ];
  const results = await Promise.all(
    checks.map(async ([name, url]) => {
      try {
        const response = await globalThis.fetch(url, {
          signal: globalThis.AbortSignal.timeout(3000),
        });
        const body = await response.text();
        const healthy = response.ok && (name !== '文档编辑器' || body.trim() === 'true');
        return `${name}：${healthy ? '就绪' : '尚未就绪'}`;
      } catch {
        return `${name}：尚未就绪`;
      }
    })
  );
  results.forEach((result) => console.log(result));
}

async function main() {
  if (['help', '--help', '-h'].includes(command)) {
    console.log('用法：node scripts/office-runtime.mjs <start|status|stop>');
    return;
  }
  if (!['start', 'status', 'stop'].includes(command) || process.argv.length > 3) {
    throw new Error('用法：node scripts/office-runtime.mjs <start|status|stop>');
  }
  const docker = executable('docker');
  if (!docker)
    throw new Error('找不到 Docker CLI，请安装：brew install docker docker-compose colima。');
  const compose = composeRunner(composeExecutable(docker));

  if (command === 'start') {
    initializeSecret();
    const fonts = prepareOfficeFonts();
    console.log(`中文常规与粗体字体${fonts.changed ? '已生成' : '已校验'}。`);
    compose('config', '--quiet');
    startRuntime(docker);
    console.log('正在启动文档编辑器与文件桥接服务。');
    compose('up', '--detach', '--wait', '--wait-timeout', '420');
    // Use Docs' own generator for AllFonts.js, converter selection and JS caches.
    // "true" generates the assets without restarting active editing services.
    compose('exec', '-T', 'documentserver', '/usr/bin/documentserver-generate-allfonts.sh', 'true');
    compose('ps');
    await serviceHealth();
    return;
  }

  if (!runtimeReady(docker)) {
    console.log('文档服务专用运行环境未启动，保存的数据保留。');
    return;
  }
  if (!existsSync(envFile)) {
    console.log('文档服务尚未初始化，请运行 node scripts/office-runtime.mjs start。');
    return;
  }
  validateSecret();
  if (command === 'stop') {
    compose('stop', '--timeout', '60');
    console.log('文档服务已停止，保存的数据保留。');
    return;
  }
  compose('ps', '--all');
  await serviceHealth();
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
