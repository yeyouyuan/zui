/** ZUI 文案（locale）契约 —— 见 CONTRACTS-V2 §3 / CONTRACTS-V3 §6 */

/* ---------------------------------- 类型 ---------------------------------- */

/** 递归局部覆盖类型：数组保持数组类型，文案段可只覆盖单个键。 */
export type DeepPartial<T> = T extends readonly unknown[] ? T : T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

/** 全量文案表（默认 zh-CN） */
export interface ZuiLocale {
  accessibility: { loading: string; removeTag: string; breadcrumb: string; colorPicker: string; colorPanel: string; saturationBrightness: string; colorValue: string; hue: string; hex: string; searchResults: string; noMatch: string; searchCascader: string; column: string; increase: string; decrease: string; mentions: string; imagePreview: string; closePreview: string; backTop: string; slider: string; rating: string; ratingValue: string; floatAction: string; removeItem: string; qrCode: string; sourceList: string; targetList: string; selectAllSource: string; selectAllTarget: string; searchSource: string; searchTarget: string };
  form: { required: string; minNumber: string; maxNumber: string; minLength: string; maxLength: string; pattern: string; validator: string };
  result: { 'success': string; 'error': string; 'warning': string; 'info': string; '403': string; '404': string; '500': string };

  select: { placeholder: string; empty: string }; // '请选择' / '暂无选项'
  input: { clear: string }; // '清除'
  modal: { close: string }; // '关闭'
  drawer: { close: string }; // '关闭'
  message: { close: string }; // '关闭'
  pagination: {
    prev: string; // '上一页'
    next: string; // '下一页'
    jumper: string; // '跳至'
    label: string; // '分页'（nav aria-label）
    jumperLabel: string; // '跳至页码'（跳页输入框 aria-label）
    unit: string; // '页'（"跳至 N 页"的单位后缀）
  };
  empty: { description: string }; // '暂无数据'
  /** 日期类组件（DatePicker / Calendar 等） */
  date: {
    today: string; // '今天'
    previousMonth: string; // '上一月'
    nextMonth: string; // '下一月'
    previousYear: string; // '上一年'
    nextYear: string; // '下一年'
    /** 月份标题模板：'{year}年{month}月'（{month} 为 1 起始数字） */
    monthFormat: string;
    placeholder: string; // '请选择日期'
    inputLabel: string; // '日期'（输入框 aria-label）
    panelLabel: string; // '选择日期'（弹出面板 aria-label）
    /** 星期列表头 aria-label 模板：'星期{name}'（{name} 取 weekdays 对应项） */
    weekdayFormat: string;
    /** 星期列表头文案（周一为首日） */
    weekdays: string[]; // ['一','二','三','四','五','六','日']
  };
  /** 穿梭框（Transfer） */
  transfer: {
    search: string; // '搜索'
    itemUnit: string; // '项'
    moveRight: string; // '移动到目标列表'（右移按钮 aria-label）
    moveLeft: string; // '移动到源列表'（左移按钮 aria-label）
  };
  /** 时间选择（TimePicker） */
  timePicker: {
    ok: string; // '确定'
    cancel: string; // '取消'
    placeholder: string; // '请选择时间'
    hour: string; // '时'（时列 aria-label）
    minute: string; // '分'（分列 aria-label）
    second: string; // '秒'（秒列 aria-label）
  };
  /** 气泡确认（Popconfirm） */
  popconfirm: {
    ok: string; // '确定'
    cancel: string; // '取消'
  };
  app: { confirm: string };
  /** 漫游引导（Tour） */
  tour: {
    prev: string; // '上一步'
    next: string; // '下一步'
    finish: string; // '完成'
  };
}

/* -------------------------------- 语言包 -------------------------------- */

/** 默认 zh-CN 简体中文 */
export const zhCN: ZuiLocale = {
  accessibility: {"loading": "加载中", "removeTag": "移除标签", "breadcrumb": "面包屑", "colorPicker": "颜色选择器", "colorPanel": "颜色选择面板", "saturationBrightness": "饱和度与亮度", "colorValue": "饱和度 {s}%，亮度 {v}%", "hue": "色相", "hex": "十六进制颜色值", "searchResults": "搜索结果", "noMatch": "暂无匹配", "searchCascader": "搜索级联选项", "column": "第 {index} 列", "increase": "增加", "decrease": "减少", "mentions": "提及建议", "imagePreview": "图片预览", "closePreview": "关闭预览", "backTop": "返回顶部", "slider": "滑块", "rating": "评分", "ratingValue": "{index} 分", "floatAction": "悬浮操作", "removeItem": "移除 {item}", "qrCode": "二维码：{value}", "sourceList": "源列表", "targetList": "目标列表", "selectAllSource": "全选源列表", "selectAllTarget": "全选目标列表", "searchSource": "搜索源列表", "searchTarget": "搜索目标列表"},
  form: {"required": "该项为必填", "minNumber": "数值不能小于 {min}", "maxNumber": "数值不能大于 {max}", "minLength": "长度不能少于 {min}", "maxLength": "长度不能超过 {max}", "pattern": "格式不正确", "validator": "校验不通过"},
  result: {"success": "操作成功", "error": "操作失败", "warning": "警告", "info": "提示", "403": "403", "404": "404", "500": "500"},

  select: { placeholder: '请选择', empty: '暂无选项' },
  input: { clear: '清除' },
  modal: { close: '关闭' },
  drawer: { close: '关闭' },
  message: { close: '关闭' },
  pagination: {
    prev: '上一页',
    next: '下一页',
    jumper: '跳至',
    label: '分页',
    jumperLabel: '跳至页码',
    unit: '页',
  },
  empty: { description: '暂无数据' },
  date: {
    today: '今天',
    previousMonth: '上一月',
    nextMonth: '下一月',
    previousYear: '上一年',
    nextYear: '下一年',
    monthFormat: '{year}年{month}月',
    placeholder: '请选择日期',
    inputLabel: '日期',
    panelLabel: '选择日期',
    weekdayFormat: '星期{name}',
    weekdays: ['一', '二', '三', '四', '五', '六', '日'],
  },
  transfer: { search: '搜索', itemUnit: '项', moveRight: '移动到目标列表', moveLeft: '移动到源列表' },
  timePicker: {
    ok: '确定',
    cancel: '取消',
    placeholder: '请选择时间',
    hour: '时',
    minute: '分',
    second: '秒',
  },
  popconfirm: { ok: '确定', cancel: '取消' },
  app: { confirm: '确认' },
  tour: { prev: '上一步', next: '下一步', finish: '完成' },
};

/** en-US English */
export const enUS: ZuiLocale = {
  accessibility: {"loading": "Loading", "removeTag": "Remove tag", "breadcrumb": "Breadcrumb", "colorPicker": "Color picker", "colorPanel": "Color selection", "saturationBrightness": "Saturation and brightness", "colorValue": "Saturation {s}%, brightness {v}%", "hue": "Hue", "hex": "Hex color", "searchResults": "Search results", "noMatch": "No matches", "searchCascader": "Search cascader options", "column": "Column {index}", "increase": "Increase", "decrease": "Decrease", "mentions": "Mention suggestions", "imagePreview": "Image preview", "closePreview": "Close preview", "backTop": "Back to top", "slider": "Slider", "rating": "Rating", "ratingValue": "{index} stars", "floatAction": "Floating action", "removeItem": "Remove {item}", "qrCode": "QR code: {value}", "sourceList": "Source list", "targetList": "Target list", "selectAllSource": "Select all source items", "selectAllTarget": "Select all target items", "searchSource": "Search source list", "searchTarget": "Search target list"},
  form: {"required": "This field is required", "minNumber": "Value must be at least {min}", "maxNumber": "Value must be at most {max}", "minLength": "Use at least {min} characters", "maxLength": "Use at most {max} characters", "pattern": "Invalid format", "validator": "Validation failed"},
  result: {"success": "Success", "error": "Operation failed", "warning": "Warning", "info": "Information", "403": "403", "404": "404", "500": "500"},

  select: { placeholder: 'Select...', empty: 'No options' },
  input: { clear: 'Clear' },
  modal: { close: 'Close' },
  drawer: { close: 'Close' },
  message: { close: 'Close' },
  pagination: {
    prev: 'Previous',
    next: 'Next',
    jumper: 'Go to',
    label: 'Pagination',
    jumperLabel: 'Go to page',
    unit: '',
  },
  empty: { description: 'No data' },
  date: {
    today: 'Today',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    previousYear: 'Previous year',
    nextYear: 'Next year',
    monthFormat: '{year}-{month}',
    placeholder: 'Select date',
    inputLabel: 'Date',
    panelLabel: 'Select date',
    weekdayFormat: '{name}',
    weekdays: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
  },
  transfer: { search: 'Search', itemUnit: 'items', moveRight: 'Move to target', moveLeft: 'Move to source' },
  timePicker: {
    ok: 'OK',
    cancel: 'Cancel',
    placeholder: 'Select time',
    hour: 'Hour',
    minute: 'Minute',
    second: 'Second',
  },
  popconfirm: { ok: 'OK', cancel: 'Cancel' },
  app: { confirm: 'Confirm' },
  tour: { prev: 'Previous', next: 'Next', finish: 'Finish' },
};

/** zh-TW 繁體中文 */
export const zhTW: ZuiLocale = {
  accessibility: {"loading": "載入中", "removeTag": "移除標籤", "breadcrumb": "麵包屑", "colorPicker": "顏色選擇器", "colorPanel": "顏色選擇面板", "saturationBrightness": "飽和度與亮度", "colorValue": "飽和度 {s}%，亮度 {v}%", "hue": "色相", "hex": "十六進位顏色值", "searchResults": "搜尋結果", "noMatch": "暫無符合項目", "searchCascader": "搜尋級聯選項", "column": "第 {index} 欄", "increase": "增加", "decrease": "減少", "mentions": "提及建議", "imagePreview": "圖片預覽", "closePreview": "關閉預覽", "backTop": "返回頂部", "slider": "滑桿", "rating": "評分", "ratingValue": "{index} 分", "floatAction": "懸浮操作", "removeItem": "移除 {item}", "qrCode": "QR 碼：{value}", "sourceList": "來源列表", "targetList": "目標列表", "selectAllSource": "全選來源列表", "selectAllTarget": "全選目標列表", "searchSource": "搜尋來源列表", "searchTarget": "搜尋目標列表"},
  form: {"required": "此項為必填", "minNumber": "數值不能小於 {min}", "maxNumber": "數值不能大於 {max}", "minLength": "長度不能少於 {min}", "maxLength": "長度不能超過 {max}", "pattern": "格式不正確", "validator": "驗證未通過"},
  result: {"success": "操作成功", "error": "操作失敗", "warning": "警告", "info": "提示", "403": "403", "404": "404", "500": "500"},

  select: { placeholder: '請選擇', empty: '暫無選項' },
  input: { clear: '清除' },
  modal: { close: '關閉' },
  drawer: { close: '關閉' },
  message: { close: '關閉' },
  pagination: {
    prev: '上一頁',
    next: '下一頁',
    jumper: '跳至',
    label: '分頁',
    jumperLabel: '跳至頁碼',
    unit: '頁',
  },
  empty: { description: '暫無資料' },
  date: {
    today: '今天',
    previousMonth: '上個月',
    nextMonth: '下個月',
    previousYear: '前一年',
    nextYear: '後一年',
    monthFormat: '{year}年{month}月',
    placeholder: '請選擇日期',
    inputLabel: '日期',
    panelLabel: '選擇日期',
    weekdayFormat: '星期{name}',
    weekdays: ['一', '二', '三', '四', '五', '六', '日'],
  },
  transfer: { search: '搜尋', itemUnit: '項', moveRight: '移至目標列表', moveLeft: '移至來源列表' },
  timePicker: {
    ok: '確定',
    cancel: '取消',
    placeholder: '請選擇時間',
    hour: '時',
    minute: '分',
    second: '秒',
  },
  popconfirm: { ok: '確定', cancel: '取消' },
  app: { confirm: '確認' },
  tour: { prev: '上一步', next: '下一步', finish: '完成' },
};

/** ja-JP 日本語 */
export const jaJP: ZuiLocale = {
  accessibility: {"loading": "読み込み中", "removeTag": "タグを削除", "breadcrumb": "パンくずリスト", "colorPicker": "カラーピッカー", "colorPanel": "色の選択", "saturationBrightness": "彩度と明度", "colorValue": "彩度 {s}%、明度 {v}%", "hue": "色相", "hex": "16進数カラー", "searchResults": "検索結果", "noMatch": "一致する項目なし", "searchCascader": "カスケードを検索", "column": "列 {index}", "increase": "増やす", "decrease": "減らす", "mentions": "メンション候補", "imagePreview": "画像プレビュー", "closePreview": "プレビューを閉じる", "backTop": "先頭に戻る", "slider": "スライダー", "rating": "評価", "ratingValue": "{index} つ星", "floatAction": "フローティング操作", "removeItem": "{item} を削除", "qrCode": "QR コード：{value}", "sourceList": "元のリスト", "targetList": "選択済みリスト", "selectAllSource": "元の項目をすべて選択", "selectAllTarget": "選択済み項目をすべて選択", "searchSource": "元のリストを検索", "searchTarget": "選択済みリストを検索"},
  form: {"required": "必須項目です", "minNumber": "値は {min} 以上にしてください", "maxNumber": "値は {max} 以下にしてください", "minLength": "{min} 文字以上にしてください", "maxLength": "{max} 文字以下にしてください", "pattern": "形式が正しくありません", "validator": "検証に失敗しました"},
  result: {"success": "完了", "error": "操作に失敗しました", "warning": "警告", "info": "情報", "403": "403", "404": "404", "500": "500"},

  select: { placeholder: '選択してください', empty: 'データがありません' },
  input: { clear: 'クリア' },
  modal: { close: '閉じる' },
  drawer: { close: '閉じる' },
  message: { close: '閉じる' },
  pagination: {
    prev: '前へ',
    next: '次へ',
    jumper: '移動',
    label: 'ページネーション',
    jumperLabel: 'ページ移動',
    unit: 'ページ',
  },
  empty: { description: 'データなし' },
  date: {
    today: '今日',
    previousMonth: '前月',
    nextMonth: '翌月',
    previousYear: '前年',
    nextYear: '翌年',
    monthFormat: '{year}年{month}月',
    placeholder: '日付を選択',
    inputLabel: '日付',
    panelLabel: '日付選択',
    weekdayFormat: '{name}曜日',
    weekdays: ['月', '火', '水', '木', '金', '土', '日'],
  },
  transfer: { search: '検索', itemUnit: '件', moveRight: '右へ移動', moveLeft: '左へ移動' },
  timePicker: {
    ok: '決定',
    cancel: 'キャンセル',
    placeholder: '時間を選択',
    hour: '時',
    minute: '分',
    second: '秒',
  },
  popconfirm: { ok: '決定', cancel: 'キャンセル' },
  app: { confirm: '確認' },
  tour: { prev: '前へ', next: '次へ', finish: '完了' },
};

/** ko-KR 한국어 */
export const koKR: ZuiLocale = {
  accessibility: {"loading": "로딩 중", "removeTag": "태그 제거", "breadcrumb": "탐색 경로", "colorPicker": "색상 선택기", "colorPanel": "색상 선택 패널", "saturationBrightness": "채도 및 밝기", "colorValue": "채도 {s}%, 밝기 {v}%", "hue": "색조", "hex": "16진수 색상", "searchResults": "검색 결과", "noMatch": "일치하는 항목 없음", "searchCascader": "계층 옵션 검색", "column": "열 {index}", "increase": "증가", "decrease": "감소", "mentions": "멘션 제안", "imagePreview": "이미지 미리보기", "closePreview": "미리보기 닫기", "backTop": "맨 위로", "slider": "슬라이더", "rating": "평점", "ratingValue": "별 {index}개", "floatAction": "플로팅 작업", "removeItem": "{item} 제거", "qrCode": "QR 코드: {value}", "sourceList": "원본 목록", "targetList": "대상 목록", "selectAllSource": "원본 전체 선택", "selectAllTarget": "대상 전체 선택", "searchSource": "원본 검색", "searchTarget": "대상 검색"},
  form: {"required": "필수 항목입니다", "minNumber": "값은 {min} 이상이어야 합니다", "maxNumber": "값은 {max} 이하여야 합니다", "minLength": "{min}자 이상 입력하세요", "maxLength": "{max}자 이하로 입력하세요", "pattern": "잘못된 형식입니다", "validator": "검증 실패"},
  result: {"success": "성공", "error": "작업 실패", "warning": "경고", "info": "안내", "403": "403", "404": "404", "500": "500"},

  select: { placeholder: '선택하세요', empty: '옵션 없음' },
  input: { clear: '지우기' },
  modal: { close: '닫기' },
  drawer: { close: '닫기' },
  message: { close: '닫기' },
  pagination: {
    prev: '이전',
    next: '다음',
    jumper: '이동',
    label: '페이지네이션',
    jumperLabel: '페이지 이동',
    unit: '페이지',
  },
  empty: { description: '데이터 없음' },
  date: {
    today: '오늘',
    previousMonth: '이전 달',
    nextMonth: '다음 달',
    previousYear: '이전 해',
    nextYear: '다음 해',
    monthFormat: '{year}년 {month}월',
    placeholder: '날짜 선택',
    inputLabel: '날짜',
    panelLabel: '날짜 선택',
    weekdayFormat: '{name}요일',
    weekdays: ['월', '화', '수', '목', '금', '토', '일'],
  },
  transfer: { search: '검색', itemUnit: '개', moveRight: '오른쪽으로 이동', moveLeft: '왼쪽으로 이동' },
  timePicker: {
    ok: '확인',
    cancel: '취소',
    placeholder: '시간 선택',
    hour: '시',
    minute: '분',
    second: '초',
  },
  popconfirm: { ok: '확인', cancel: '취소' },
  app: { confirm: '확인' },
  tour: { prev: '이전', next: '다음', finish: '완료' },
};

/* --------------------------------- 深合并 --------------------------------- */

/**
 * 逐段深合并：override 中提供的段与 base 对应段合并，未提供的段沿用 base。
 * 不修改入参，返回新对象。
 */
export function mergeLocale(base: ZuiLocale, override?: DeepPartial<ZuiLocale>): ZuiLocale {
  if (!override) return base;
  return {
    accessibility: { ...base.accessibility, ...override.accessibility },
    form: { ...base.form, ...override.form },
    result: { ...base.result, ...override.result },
    select: { ...base.select, ...override.select },
    input: { ...base.input, ...override.input },
    modal: { ...base.modal, ...override.modal },
    drawer: { ...base.drawer, ...override.drawer },
    message: { ...base.message, ...override.message },
    pagination: { ...base.pagination, ...override.pagination },
    empty: { ...base.empty, ...override.empty },
    date: { ...base.date, ...override.date, weekdays: override.date?.weekdays ? [...override.date.weekdays] : [...base.date.weekdays] },
    transfer: { ...base.transfer, ...override.transfer },
    timePicker: { ...base.timePicker, ...override.timePicker },
    popconfirm: { ...base.popconfirm, ...override.popconfirm },
    app: { ...base.app, ...override.app },
    tour: { ...base.tour, ...override.tour },
  };
}
