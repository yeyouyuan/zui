/** ZUI 文案（locale）契约 —— 见 CONTRACTS-V2 §3 / CONTRACTS-V3 §6 */

/* ---------------------------------- 类型 ---------------------------------- */

/** 递归局部覆盖类型：数组保持数组类型，文案段可只覆盖单个键。 */
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** 全量文案表（默认 zh-CN） */
export interface ZuiLocale {
  accessibility: {
    loading: string;
    removeTag: string;
    breadcrumb: string;
    colorPicker: string;
    colorPanel: string;
    saturationBrightness: string;
    colorValue: string;
    hue: string;
    hex: string;
    searchResults: string;
    noMatch: string;
    searchCascader: string;
    anchor: string;
    copy: string;
    copied: string;
    column: string;
    increase: string;
    decrease: string;
    mentions: string;
    imagePreview: string;
    closePreview: string;
    backTop: string;
    slider: string;
    rating: string;
    ratingValue: string;
    floatAction: string;
    removeItem: string;
    qrCode: string;
    sourceList: string;
    targetList: string;
    selectAllSource: string;
    selectAllTarget: string;
    searchSource: string;
    searchTarget: string;
  };
  form: {
    required: string;
    minNumber: string;
    maxNumber: string;
    minLength: string;
    maxLength: string;
    pattern: string;
    validator: string;
  };
  result: {
    success: string;
    error: string;
    warning: string;
    info: string;
    '403': string;
    '404': string;
    '500': string;
  };

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
  /** 上传（Upload） */
  upload: {
    text: string; // '点击上传'
    dragText: string; // '点击或拖拽文件到此处'
    remove: string; // '删除文件'（移除按钮 aria-label）
  };
  /** 步骤条（Steps） */
  steps: {
    label: string; // '步骤条'（nav aria-label）
  };
  /** 日期范围（DateRangePicker） */
  dateRange: {
    startPlaceholder: string; // '开始日期'
    endPlaceholder: string; // '结束日期'
    separator: string; // '至'（两个日期间的分隔符）
    panelLabel: string; // '选择日期范围'（弹出面板 aria-label）
  };
}

/* -------------------------------- 语言包 -------------------------------- */

/** 默认 zh-CN 简体中文 */
export const zhCN: ZuiLocale = {
  accessibility: {
    loading: '加载中',
    removeTag: '移除标签',
    breadcrumb: '面包屑',
    colorPicker: '颜色选择器',
    colorPanel: '颜色选择面板',
    saturationBrightness: '饱和度与亮度',
    colorValue: '饱和度 {s}%，亮度 {v}%',
    hue: '色相',
    hex: '十六进制颜色值',
    searchResults: '搜索结果',
    noMatch: '暂无匹配',
    searchCascader: '搜索级联选项',
    column: '第 {index} 列',
    increase: '增加',
    decrease: '减少',
    mentions: '提及建议',
    imagePreview: '图片预览',
    closePreview: '关闭预览',
    backTop: '返回顶部',
    slider: '滑块',
    rating: '评分',
    ratingValue: '{index} 分',
    floatAction: '悬浮操作',
    removeItem: '移除 {item}',
    qrCode: '二维码：{value}',
    anchor: '锚点导航',
    copy: '复制',
    copied: '已复制',
    sourceList: '源列表',
    targetList: '目标列表',
    selectAllSource: '全选源列表',
    selectAllTarget: '全选目标列表',
    searchSource: '搜索源列表',
    searchTarget: '搜索目标列表',
  },
  form: {
    required: '该项为必填',
    minNumber: '数值不能小于 {min}',
    maxNumber: '数值不能大于 {max}',
    minLength: '长度不能少于 {min}',
    maxLength: '长度不能超过 {max}',
    pattern: '格式不正确',
    validator: '校验不通过',
  },
  result: {
    success: '操作成功',
    error: '操作失败',
    warning: '警告',
    info: '提示',
    '403': '403',
    '404': '404',
    '500': '500',
  },

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
  transfer: {
    search: '搜索',
    itemUnit: '项',
    moveRight: '移动到目标列表',
    moveLeft: '移动到源列表',
  },
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
  upload: { text: '点击上传', dragText: '点击或拖拽文件到此处', remove: '删除文件' },
  steps: { label: '步骤条' },
  dateRange: {
    startPlaceholder: '开始日期',
    endPlaceholder: '结束日期',
    separator: '至',
    panelLabel: '选择日期范围',
  },
};

/** en-US English */
export const enUS: ZuiLocale = {
  accessibility: {
    loading: 'Loading',
    removeTag: 'Remove tag',
    breadcrumb: 'Breadcrumb',
    colorPicker: 'Color picker',
    colorPanel: 'Color selection',
    saturationBrightness: 'Saturation and brightness',
    colorValue: 'Saturation {s}%, brightness {v}%',
    hue: 'Hue',
    hex: 'Hex color',
    searchResults: 'Search results',
    noMatch: 'No matches',
    searchCascader: 'Search cascader options',
    column: 'Column {index}',
    increase: 'Increase',
    decrease: 'Decrease',
    mentions: 'Mention suggestions',
    imagePreview: 'Image preview',
    closePreview: 'Close preview',
    backTop: 'Back to top',
    slider: 'Slider',
    rating: 'Rating',
    ratingValue: '{index} stars',
    floatAction: 'Floating action',
    removeItem: 'Remove {item}',
    qrCode: 'QR code: {value}',
    anchor: 'Anchor navigation',
    copy: 'Copy',
    copied: 'Copied',
    sourceList: 'Source list',
    targetList: 'Target list',
    selectAllSource: 'Select all source items',
    selectAllTarget: 'Select all target items',
    searchSource: 'Search source list',
    searchTarget: 'Search target list',
  },
  form: {
    required: 'This field is required',
    minNumber: 'Value must be at least {min}',
    maxNumber: 'Value must be at most {max}',
    minLength: 'Use at least {min} characters',
    maxLength: 'Use at most {max} characters',
    pattern: 'Invalid format',
    validator: 'Validation failed',
  },
  result: {
    success: 'Success',
    error: 'Operation failed',
    warning: 'Warning',
    info: 'Information',
    '403': '403',
    '404': '404',
    '500': '500',
  },

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
  transfer: {
    search: 'Search',
    itemUnit: 'items',
    moveRight: 'Move to target',
    moveLeft: 'Move to source',
  },
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
  upload: { text: 'Click to upload', dragText: 'Click or drag files here', remove: 'Remove file' },
  steps: { label: 'Steps' },
  dateRange: {
    startPlaceholder: 'Start date',
    endPlaceholder: 'End date',
    separator: 'to',
    panelLabel: 'Select date range',
  },
};

/** zh-TW 繁體中文 */
export const zhTW: ZuiLocale = {
  accessibility: {
    loading: '載入中',
    removeTag: '移除標籤',
    breadcrumb: '麵包屑',
    colorPicker: '顏色選擇器',
    colorPanel: '顏色選擇面板',
    saturationBrightness: '飽和度與亮度',
    colorValue: '飽和度 {s}%，亮度 {v}%',
    hue: '色相',
    hex: '十六進位顏色值',
    searchResults: '搜尋結果',
    noMatch: '暫無符合項目',
    searchCascader: '搜尋級聯選項',
    column: '第 {index} 欄',
    increase: '增加',
    decrease: '減少',
    mentions: '提及建議',
    imagePreview: '圖片預覽',
    closePreview: '關閉預覽',
    backTop: '返回頂部',
    slider: '滑桿',
    rating: '評分',
    ratingValue: '{index} 分',
    floatAction: '懸浮操作',
    removeItem: '移除 {item}',
    qrCode: 'QR 碼：{value}',
    anchor: '錨點導航',
    copy: '複製',
    copied: '已複製',
    sourceList: '來源列表',
    targetList: '目標列表',
    selectAllSource: '全選來源列表',
    selectAllTarget: '全選目標列表',
    searchSource: '搜尋來源列表',
    searchTarget: '搜尋目標列表',
  },
  form: {
    required: '此項為必填',
    minNumber: '數值不能小於 {min}',
    maxNumber: '數值不能大於 {max}',
    minLength: '長度不能少於 {min}',
    maxLength: '長度不能超過 {max}',
    pattern: '格式不正確',
    validator: '驗證未通過',
  },
  result: {
    success: '操作成功',
    error: '操作失敗',
    warning: '警告',
    info: '提示',
    '403': '403',
    '404': '404',
    '500': '500',
  },

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
  upload: { text: '點擊上傳', dragText: '點擊或拖曳檔案到此處', remove: '刪除檔案' },
  steps: { label: '步驟條' },
  dateRange: {
    startPlaceholder: '開始日期',
    endPlaceholder: '結束日期',
    separator: '至',
    panelLabel: '選擇日期範圍',
  },
};

/** ja-JP 日本語 */
export const jaJP: ZuiLocale = {
  accessibility: {
    loading: '読み込み中',
    removeTag: 'タグを削除',
    breadcrumb: 'パンくずリスト',
    colorPicker: 'カラーピッカー',
    colorPanel: '色の選択',
    saturationBrightness: '彩度と明度',
    colorValue: '彩度 {s}%、明度 {v}%',
    hue: '色相',
    hex: '16進数カラー',
    searchResults: '検索結果',
    noMatch: '一致する項目なし',
    searchCascader: 'カスケードを検索',
    column: '列 {index}',
    increase: '増やす',
    decrease: '減らす',
    mentions: 'メンション候補',
    imagePreview: '画像プレビュー',
    closePreview: 'プレビューを閉じる',
    backTop: '先頭に戻る',
    slider: 'スライダー',
    rating: '評価',
    ratingValue: '{index} つ星',
    floatAction: 'フローティング操作',
    removeItem: '{item} を削除',
    qrCode: 'QR コード：{value}',
    anchor: 'アンカー',
    copy: 'コピー',
    copied: 'コピーしました',
    sourceList: '元のリスト',
    targetList: '選択済みリスト',
    selectAllSource: '元の項目をすべて選択',
    selectAllTarget: '選択済み項目をすべて選択',
    searchSource: '元のリストを検索',
    searchTarget: '選択済みリストを検索',
  },
  form: {
    required: '必須項目です',
    minNumber: '値は {min} 以上にしてください',
    maxNumber: '値は {max} 以下にしてください',
    minLength: '{min} 文字以上にしてください',
    maxLength: '{max} 文字以下にしてください',
    pattern: '形式が正しくありません',
    validator: '検証に失敗しました',
  },
  result: {
    success: '完了',
    error: '操作に失敗しました',
    warning: '警告',
    info: '情報',
    '403': '403',
    '404': '404',
    '500': '500',
  },

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
  upload: {
    text: 'クリックしてアップロード',
    dragText: 'クリックまたはファイルをドラッグ',
    remove: 'ファイルを削除',
  },
  steps: { label: 'ステップ' },
  dateRange: {
    startPlaceholder: '開始日',
    endPlaceholder: '終了日',
    separator: '〜',
    panelLabel: '期間を選択',
  },
};

/** ko-KR 한국어 */
export const koKR: ZuiLocale = {
  accessibility: {
    loading: '로딩 중',
    removeTag: '태그 제거',
    breadcrumb: '탐색 경로',
    colorPicker: '색상 선택기',
    colorPanel: '색상 선택 패널',
    saturationBrightness: '채도 및 밝기',
    colorValue: '채도 {s}%, 밝기 {v}%',
    hue: '색조',
    hex: '16진수 색상',
    searchResults: '검색 결과',
    noMatch: '일치하는 항목 없음',
    searchCascader: '계층 옵션 검색',
    column: '열 {index}',
    increase: '증가',
    decrease: '감소',
    mentions: '멘션 제안',
    imagePreview: '이미지 미리보기',
    closePreview: '미리보기 닫기',
    backTop: '맨 위로',
    slider: '슬라이더',
    rating: '평점',
    ratingValue: '별 {index}개',
    floatAction: '플로팅 작업',
    removeItem: '{item} 제거',
    qrCode: 'QR 코드: {value}',
    anchor: '앵커 탐색',
    copy: '복사',
    copied: '복사됨',
    sourceList: '원본 목록',
    targetList: '대상 목록',
    selectAllSource: '원본 전체 선택',
    selectAllTarget: '대상 전체 선택',
    searchSource: '원본 검색',
    searchTarget: '대상 검색',
  },
  form: {
    required: '필수 항목입니다',
    minNumber: '값은 {min} 이상이어야 합니다',
    maxNumber: '값은 {max} 이하여야 합니다',
    minLength: '{min}자 이상 입력하세요',
    maxLength: '{max}자 이하로 입력하세요',
    pattern: '잘못된 형식입니다',
    validator: '검증 실패',
  },
  result: {
    success: '성공',
    error: '작업 실패',
    warning: '경고',
    info: '안내',
    '403': '403',
    '404': '404',
    '500': '500',
  },

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
  transfer: {
    search: '검색',
    itemUnit: '개',
    moveRight: '오른쪽으로 이동',
    moveLeft: '왼쪽으로 이동',
  },
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
  upload: {
    text: '클릭하여 업로드',
    dragText: '클릭 또는 파일을 끌어다 놓기',
    remove: '파일 삭제',
  },
  steps: { label: '단계' },
  dateRange: {
    startPlaceholder: '시작 날짜',
    endPlaceholder: '종료 날짜',
    separator: '부터',
    panelLabel: '기간 선택',
  },
};

/** fr-FR Français */
export const frFR: ZuiLocale = {
  accessibility: {
    loading: 'Chargement',
    removeTag: 'Supprimer le tag',
    breadcrumb: "Fil d'Ariane",
    colorPicker: 'Sélecteur de couleurs',
    colorPanel: 'Sélection de couleur',
    saturationBrightness: 'Saturation et luminosité',
    colorValue: 'Saturation {s} %, luminosité {v} %',
    hue: 'Teinte',
    hex: 'Couleur hexadécimale',
    searchResults: 'Résultats de recherche',
    noMatch: 'Aucun résultat',
    searchCascader: 'Rechercher dans les options en cascade',
    column: 'Colonne {index}',
    increase: 'Augmenter',
    decrease: 'Diminuer',
    mentions: 'Suggestions de mention',
    imagePreview: "Aperçu de l'image",
    closePreview: "Fermer l'aperçu",
    backTop: 'Retour en haut',
    slider: 'Curseur',
    rating: 'Note',
    ratingValue: '{index} étoiles',
    floatAction: 'Action flottante',
    removeItem: 'Supprimer {item}',
    qrCode: 'Code QR : {value}',
    anchor: 'Navigation par ancres',
    copy: 'Copier',
    copied: 'Copié',
    sourceList: 'Liste source',
    targetList: 'Liste cible',
    selectAllSource: 'Tout sélectionner dans la liste source',
    selectAllTarget: 'Tout sélectionner dans la liste cible',
    searchSource: 'Rechercher dans la liste source',
    searchTarget: 'Rechercher dans la liste cible',
  },
  form: {
    required: 'Ce champ est obligatoire',
    minNumber: 'La valeur doit être au moins {min}',
    maxNumber: 'La valeur doit être au plus {max}',
    minLength: 'Utilisez au moins {min} caractères',
    maxLength: 'Utilisez au plus {max} caractères',
    pattern: 'Format invalide',
    validator: 'Échec de la validation',
  },
  result: {
    success: 'Opération réussie',
    error: "Échec de l'opération",
    warning: 'Avertissement',
    info: 'Information',
    '403': '403',
    '404': '404',
    '500': '500',
  },

  select: { placeholder: 'Sélectionner...', empty: 'Aucune option' },
  input: { clear: 'Effacer' },
  modal: { close: 'Fermer' },
  drawer: { close: 'Fermer' },
  message: { close: 'Fermer' },
  pagination: {
    prev: 'Précédent',
    next: 'Suivant',
    jumper: 'Aller à',
    label: 'Pagination',
    jumperLabel: 'Aller à la page',
    unit: '',
  },
  empty: { description: 'Aucune donnée' },
  date: {
    today: "Aujourd'hui",
    previousMonth: 'Mois précédent',
    nextMonth: 'Mois suivant',
    previousYear: 'Année précédente',
    nextYear: 'Année suivante',
    monthFormat: '{month}/{year}',
    placeholder: 'Sélectionner une date',
    inputLabel: 'Date',
    panelLabel: 'Sélectionner une date',
    weekdayFormat: '{name}',
    weekdays: ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'],
  },
  transfer: {
    search: 'Rechercher',
    itemUnit: 'éléments',
    moveRight: 'Déplacer vers la cible',
    moveLeft: 'Déplacer vers la source',
  },
  timePicker: {
    ok: 'OK',
    cancel: 'Annuler',
    placeholder: "Sélectionner l'heure",
    hour: 'Heure',
    minute: 'Minute',
    second: 'Seconde',
  },
  popconfirm: { ok: 'OK', cancel: 'Annuler' },
  app: { confirm: 'Confirmer' },
  tour: { prev: 'Précédent', next: 'Suivant', finish: 'Terminer' },
  upload: {
    text: 'Cliquez pour importer',
    dragText: 'Cliquez ou déposez des fichiers ici',
    remove: 'Supprimer le fichier',
  },
  steps: { label: 'Étapes' },
  dateRange: {
    startPlaceholder: 'Date de début',
    endPlaceholder: 'Date de fin',
    separator: 'au',
    panelLabel: 'Sélectionner une période',
  },
};

/** de-DE Deutsch */
export const deDE: ZuiLocale = {
  accessibility: {
    loading: 'Wird geladen',
    removeTag: 'Tag entfernen',
    breadcrumb: 'Breadcrumb-Navigation',
    colorPicker: 'Farbwähler',
    colorPanel: 'Farbauswahl',
    saturationBrightness: 'Sättigung und Helligkeit',
    colorValue: 'Sättigung {s} %, Helligkeit {v} %',
    hue: 'Farbton',
    hex: 'Hexadezimaler Farbwert',
    searchResults: 'Suchergebnisse',
    noMatch: 'Keine Treffer',
    searchCascader: 'Kaskadenoptionen durchsuchen',
    column: 'Spalte {index}',
    increase: 'Erhöhen',
    decrease: 'Verringern',
    mentions: 'Erwähnungsvorschläge',
    imagePreview: 'Bildvorschau',
    closePreview: 'Vorschau schließen',
    backTop: 'Nach oben',
    slider: 'Schieberegler',
    rating: 'Bewertung',
    ratingValue: '{index} Sterne',
    floatAction: 'Schwebende Aktion',
    removeItem: '{item} entfernen',
    qrCode: 'QR-Code: {value}',
    anchor: 'Anker-Navigation',
    copy: 'Kopieren',
    copied: 'Kopiert',
    sourceList: 'Quellliste',
    targetList: 'Zielliste',
    selectAllSource: 'Alle Quellelemente auswählen',
    selectAllTarget: 'Alle Zielelemente auswählen',
    searchSource: 'Quellliste durchsuchen',
    searchTarget: 'Zielliste durchsuchen',
  },
  form: {
    required: 'Dieses Feld ist erforderlich',
    minNumber: 'Der Wert muss mindestens {min} sein',
    maxNumber: 'Der Wert darf höchstens {max} sein',
    minLength: 'Verwenden Sie mindestens {min} Zeichen',
    maxLength: 'Verwenden Sie höchstens {max} Zeichen',
    pattern: 'Ungültiges Format',
    validator: 'Validierung fehlgeschlagen',
  },
  result: {
    success: 'Erfolg',
    error: 'Vorgang fehlgeschlagen',
    warning: 'Warnung',
    info: 'Information',
    '403': '403',
    '404': '404',
    '500': '500',
  },

  select: { placeholder: 'Auswählen...', empty: 'Keine Optionen' },
  input: { clear: 'Löschen' },
  modal: { close: 'Schließen' },
  drawer: { close: 'Schließen' },
  message: { close: 'Schließen' },
  pagination: {
    prev: 'Zurück',
    next: 'Weiter',
    jumper: 'Gehe zu',
    label: 'Paginierung',
    jumperLabel: 'Gehe zu Seite',
    unit: '',
  },
  empty: { description: 'Keine Daten' },
  date: {
    today: 'Heute',
    previousMonth: 'Voriger Monat',
    nextMonth: 'Nächster Monat',
    previousYear: 'Voriges Jahr',
    nextYear: 'Nächstes Jahr',
    monthFormat: '{month}/{year}',
    placeholder: 'Datum auswählen',
    inputLabel: 'Datum',
    panelLabel: 'Datum auswählen',
    weekdayFormat: '{name}',
    weekdays: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
  },
  transfer: {
    search: 'Suchen',
    itemUnit: 'Elemente',
    moveRight: 'Zur Zielliste verschieben',
    moveLeft: 'Zur Quellliste verschieben',
  },
  timePicker: {
    ok: 'OK',
    cancel: 'Abbrechen',
    placeholder: 'Uhrzeit auswählen',
    hour: 'Stunde',
    minute: 'Minute',
    second: 'Sekunde',
  },
  popconfirm: { ok: 'OK', cancel: 'Abbrechen' },
  app: { confirm: 'Bestätigen' },
  tour: { prev: 'Zurück', next: 'Weiter', finish: 'Fertigstellen' },
  upload: {
    text: 'Zum Hochladen klicken',
    dragText: 'Klicken oder Dateien hierher ziehen',
    remove: 'Datei entfernen',
  },
  steps: { label: 'Schritte' },
  dateRange: {
    startPlaceholder: 'Startdatum',
    endPlaceholder: 'Enddatum',
    separator: 'bis',
    panelLabel: 'Zeitraum auswählen',
  },
};

/** es-ES Español */
export const esES: ZuiLocale = {
  accessibility: {
    loading: 'Cargando',
    removeTag: 'Eliminar etiqueta',
    breadcrumb: 'Migas de pan',
    colorPicker: 'Selector de color',
    colorPanel: 'Selección de color',
    saturationBrightness: 'Saturación y brillo',
    colorValue: 'Saturación {s} %, brillo {v} %',
    hue: 'Tono',
    hex: 'Color hexadecimal',
    searchResults: 'Resultados de búsqueda',
    noMatch: 'Sin coincidencias',
    searchCascader: 'Buscar opciones en cascada',
    column: 'Columna {index}',
    increase: 'Aumentar',
    decrease: 'Disminuir',
    mentions: 'Sugerencias de mención',
    imagePreview: 'Vista previa de imagen',
    closePreview: 'Cerrar vista previa',
    backTop: 'Volver arriba',
    slider: 'Deslizador',
    rating: 'Valoración',
    ratingValue: '{index} estrellas',
    floatAction: 'Acción flotante',
    removeItem: 'Eliminar {item}',
    qrCode: 'Código QR: {value}',
    anchor: 'Navegación por anclas',
    copy: 'Copiar',
    copied: 'Copiado',
    sourceList: 'Lista de origen',
    targetList: 'Lista de destino',
    selectAllSource: 'Seleccionar todos los elementos de origen',
    selectAllTarget: 'Seleccionar todos los elementos de destino',
    searchSource: 'Buscar en la lista de origen',
    searchTarget: 'Buscar en la lista de destino',
  },
  form: {
    required: 'Este campo es obligatorio',
    minNumber: 'El valor debe ser al menos {min}',
    maxNumber: 'El valor debe ser como máximo {max}',
    minLength: 'Utilice al menos {min} caracteres',
    maxLength: 'Utilice como máximo {max} caracteres',
    pattern: 'Formato no válido',
    validator: 'Error de validación',
  },
  result: {
    success: 'Éxito',
    error: 'La operación ha fallado',
    warning: 'Advertencia',
    info: 'Información',
    '403': '403',
    '404': '404',
    '500': '500',
  },

  select: { placeholder: 'Seleccionar...', empty: 'Sin opciones' },
  input: { clear: 'Borrar' },
  modal: { close: 'Cerrar' },
  drawer: { close: 'Cerrar' },
  message: { close: 'Cerrar' },
  pagination: {
    prev: 'Anterior',
    next: 'Siguiente',
    jumper: 'Ir a',
    label: 'Paginación',
    jumperLabel: 'Ir a la página',
    unit: '',
  },
  empty: { description: 'Sin datos' },
  date: {
    today: 'Hoy',
    previousMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
    previousYear: 'Año anterior',
    nextYear: 'Año siguiente',
    monthFormat: '{month}/{year}',
    placeholder: 'Seleccionar fecha',
    inputLabel: 'Fecha',
    panelLabel: 'Seleccionar fecha',
    weekdayFormat: '{name}',
    weekdays: ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'],
  },
  transfer: {
    search: 'Buscar',
    itemUnit: 'elementos',
    moveRight: 'Mover al destino',
    moveLeft: 'Mover al origen',
  },
  timePicker: {
    ok: 'Aceptar',
    cancel: 'Cancelar',
    placeholder: 'Seleccionar hora',
    hour: 'Hora',
    minute: 'Minuto',
    second: 'Segundo',
  },
  popconfirm: { ok: 'Aceptar', cancel: 'Cancelar' },
  app: { confirm: 'Confirmar' },
  tour: { prev: 'Anterior', next: 'Siguiente', finish: 'Finalizar' },
  upload: {
    text: 'Haz clic para subir',
    dragText: 'Haz clic o arrastra los archivos aquí',
    remove: 'Eliminar archivo',
  },
  steps: { label: 'Pasos' },
  dateRange: {
    startPlaceholder: 'Fecha de inicio',
    endPlaceholder: 'Fecha de fin',
    separator: 'a',
    panelLabel: 'Seleccionar rango de fechas',
  },
};

/** ru-RU Русский */
export const ruRU: ZuiLocale = {
  accessibility: {
    loading: 'Загрузка',
    removeTag: 'Удалить тег',
    breadcrumb: 'Навигационная цепочка',
    colorPicker: 'Выбор цвета',
    colorPanel: 'Панель выбора цвета',
    saturationBrightness: 'Насыщенность и яркость',
    colorValue: 'Насыщенность {s}%, яркость {v}%',
    hue: 'Тон',
    hex: 'Шестнадцатеричный цвет',
    searchResults: 'Результаты поиска',
    noMatch: 'Совпадений нет',
    searchCascader: 'Поиск по каскадным опциям',
    column: 'Столбец {index}',
    increase: 'Увеличить',
    decrease: 'Уменьшить',
    mentions: 'Подсказки упоминаний',
    imagePreview: 'Просмотр изображения',
    closePreview: 'Закрыть просмотр',
    backTop: 'Наверх',
    slider: 'Ползунок',
    rating: 'Оценка',
    ratingValue: '{index} звёзд',
    floatAction: 'Плавающее действие',
    removeItem: 'Удалить {item}',
    qrCode: 'QR-код: {value}',
    anchor: 'Якорная навигация',
    copy: 'Копировать',
    copied: 'Скопировано',
    sourceList: 'Исходный список',
    targetList: 'Целевой список',
    selectAllSource: 'Выбрать все элементы источника',
    selectAllTarget: 'Выбрать все элементы цели',
    searchSource: 'Поиск в исходном списке',
    searchTarget: 'Поиск в целевом списке',
  },
  form: {
    required: 'Обязательное поле',
    minNumber: 'Значение должно быть не меньше {min}',
    maxNumber: 'Значение должно быть не больше {max}',
    minLength: 'Используйте не менее {min} символов',
    maxLength: 'Используйте не более {max} символов',
    pattern: 'Неверный формат',
    validator: 'Ошибка проверки',
  },
  result: {
    success: 'Успешно',
    error: 'Не удалось выполнить операцию',
    warning: 'Предупреждение',
    info: 'Информация',
    '403': '403',
    '404': '404',
    '500': '500',
  },

  select: { placeholder: 'Выберите...', empty: 'Нет вариантов' },
  input: { clear: 'Очистить' },
  modal: { close: 'Закрыть' },
  drawer: { close: 'Закрыть' },
  message: { close: 'Закрыть' },
  pagination: {
    prev: 'Назад',
    next: 'Вперёд',
    jumper: 'Перейти к',
    label: 'Пагинация',
    jumperLabel: 'Перейти к странице',
    unit: '',
  },
  empty: { description: 'Нет данных' },
  date: {
    today: 'Сегодня',
    previousMonth: 'Прошлый месяц',
    nextMonth: 'Следующий месяц',
    previousYear: 'Прошлый год',
    nextYear: 'Следующий год',
    monthFormat: '{month}/{year}',
    placeholder: 'Выберите дату',
    inputLabel: 'Дата',
    panelLabel: 'Выбор даты',
    weekdayFormat: '{name}',
    weekdays: ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'],
  },
  transfer: {
    search: 'Поиск',
    itemUnit: 'элементов',
    moveRight: 'Переместить в целевой список',
    moveLeft: 'Переместить в исходный список',
  },
  timePicker: {
    ok: 'ОК',
    cancel: 'Отмена',
    placeholder: 'Выберите время',
    hour: 'Часы',
    minute: 'Минуты',
    second: 'Секунды',
  },
  popconfirm: { ok: 'ОК', cancel: 'Отмена' },
  app: { confirm: 'Подтвердить' },
  tour: { prev: 'Назад', next: 'Далее', finish: 'Завершить' },
  upload: {
    text: 'Нажмите для загрузки',
    dragText: 'Нажмите или перетащите файлы сюда',
    remove: 'Удалить файл',
  },
  steps: { label: 'Шаги' },
  dateRange: {
    startPlaceholder: 'Дата начала',
    endPlaceholder: 'Дата окончания',
    separator: 'по',
    panelLabel: 'Выбор диапазона дат',
  },
};

/** pt-BR Português (Brasil) */
export const ptBR: ZuiLocale = {
  accessibility: {
    loading: 'Carregando',
    removeTag: 'Remover tag',
    breadcrumb: 'Trilha de navegação',
    colorPicker: 'Seletor de cores',
    colorPanel: 'Seleção de cor',
    saturationBrightness: 'Saturação e brilho',
    colorValue: 'Saturação {s}%, brilho {v}%',
    hue: 'Matiz',
    hex: 'Cor hexadecimal',
    searchResults: 'Resultados da busca',
    noMatch: 'Nenhum resultado',
    searchCascader: 'Pesquisar opções em cascata',
    column: 'Coluna {index}',
    increase: 'Aumentar',
    decrease: 'Diminuir',
    mentions: 'Sugestões de menção',
    imagePreview: 'Pré-visualização da imagem',
    closePreview: 'Fechar pré-visualização',
    backTop: 'Voltar ao topo',
    slider: 'Controle deslizante',
    rating: 'Avaliação',
    ratingValue: '{index} estrelas',
    floatAction: 'Ação flutuante',
    removeItem: 'Remover {item}',
    qrCode: 'Código QR: {value}',
    anchor: 'Navegação por âncoras',
    copy: 'Copiar',
    copied: 'Copiado',
    sourceList: 'Lista de origem',
    targetList: 'Lista de destino',
    selectAllSource: 'Selecionar todos os itens de origem',
    selectAllTarget: 'Selecionar todos os itens de destino',
    searchSource: 'Pesquisar na lista de origem',
    searchTarget: 'Pesquisar na lista de destino',
  },
  form: {
    required: 'Este campo é obrigatório',
    minNumber: 'O valor deve ser no mínimo {min}',
    maxNumber: 'O valor deve ser no máximo {max}',
    minLength: 'Use pelo menos {min} caracteres',
    maxLength: 'Use no máximo {max} caracteres',
    pattern: 'Formato inválido',
    validator: 'Falha na validação',
  },
  result: {
    success: 'Sucesso',
    error: 'Falha na operação',
    warning: 'Aviso',
    info: 'Informação',
    '403': '403',
    '404': '404',
    '500': '500',
  },

  select: { placeholder: 'Selecione...', empty: 'Sem opções' },
  input: { clear: 'Limpar' },
  modal: { close: 'Fechar' },
  drawer: { close: 'Fechar' },
  message: { close: 'Fechar' },
  pagination: {
    prev: 'Anterior',
    next: 'Próximo',
    jumper: 'Ir para',
    label: 'Paginação',
    jumperLabel: 'Ir para a página',
    unit: '',
  },
  empty: { description: 'Sem dados' },
  date: {
    today: 'Hoje',
    previousMonth: 'Mês anterior',
    nextMonth: 'Próximo mês',
    previousYear: 'Ano anterior',
    nextYear: 'Próximo ano',
    monthFormat: '{month}/{year}',
    placeholder: 'Selecione a data',
    inputLabel: 'Data',
    panelLabel: 'Selecionar data',
    weekdayFormat: '{name}',
    weekdays: ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'],
  },
  transfer: {
    search: 'Pesquisar',
    itemUnit: 'itens',
    moveRight: 'Mover para o destino',
    moveLeft: 'Mover para a origem',
  },
  timePicker: {
    ok: 'OK',
    cancel: 'Cancelar',
    placeholder: 'Selecione o horário',
    hour: 'Hora',
    minute: 'Minuto',
    second: 'Segundo',
  },
  popconfirm: { ok: 'OK', cancel: 'Cancelar' },
  app: { confirm: 'Confirmar' },
  tour: { prev: 'Anterior', next: 'Próximo', finish: 'Concluir' },
  upload: {
    text: 'Clique para enviar',
    dragText: 'Clique ou arraste arquivos aqui',
    remove: 'Remover arquivo',
  },
  steps: { label: 'Etapas' },
  dateRange: {
    startPlaceholder: 'Data de início',
    endPlaceholder: 'Data de término',
    separator: 'a',
    panelLabel: 'Selecionar período de datas',
  },
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
    date: {
      ...base.date,
      ...override.date,
      weekdays: override.date?.weekdays ? [...override.date.weekdays] : [...base.date.weekdays],
    },
    transfer: { ...base.transfer, ...override.transfer },
    timePicker: { ...base.timePicker, ...override.timePicker },
    popconfirm: { ...base.popconfirm, ...override.popconfirm },
    app: { ...base.app, ...override.app },
    tour: { ...base.tour, ...override.tour },
    upload: { ...base.upload, ...override.upload },
    steps: { ...base.steps, ...override.steps },
    dateRange: { ...base.dateRange, ...override.dateRange },
  };
}
