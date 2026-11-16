/**
 * 文档封面：值为 `preset:<序号>`（预设渐变）、`illustration:<序号>`（预设插画）
 * 或图片地址（上传的图片）。
 */

/** 预设封面（渐变） */
export const DOC_COVER_PRESETS: string[] = [
  'linear-gradient(135deg, #c9dcff 0%, #e6d9ff 100%)',
  'linear-gradient(135deg, #bfe9ff 0%, #c8f5e4 100%)',
  'linear-gradient(135deg, #ffe2c2 0%, #ffc9d4 100%)',
  'linear-gradient(135deg, #fff1b8 0%, #ffd8a8 100%)',
  'linear-gradient(135deg, #3370ff 0%, #7f3bf5 100%)',
  'linear-gradient(135deg, #14c0ff 0%, #34c724 100%)',
  'linear-gradient(135deg, #ff8800 0%, #f54a45 100%)',
  'linear-gradient(135deg, #1f2329 0%, #51565d 100%)',
]

/** SVG 插画 → 可随封面宽度拉伸的 CSS 背景 */
function svgCover(svg: string): string {
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}") center / cover no-repeat`
}

const SVG_START =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 240" preserveAspectRatio="xMidYMid slice">'
const SVG_END = '</svg>'

/** 预设插画封面（矢量 SVG，随封面宽度自动铺满，无需外部图片资源） */
export const DOC_COVER_ILLUSTRATIONS: { label: string; background: string }[] = [
  {
    label: '晨光群山',
    background: svgCover(
      SVG_START +
        '<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#cfe4ff"/><stop offset=".55" stop-color="#ffe9d6"/><stop offset="1" stop-color="#ffc9b3"/>' +
        '</linearGradient></defs>' +
        '<rect width="1200" height="240" fill="url(#a)"/>' +
        '<circle cx="880" cy="84" r="40" fill="#fff6dd"/><circle cx="880" cy="84" r="64" fill="#fff6dd" opacity=".16"/>' +
        '<path d="M0 240 250 108 430 196 620 74 820 200 1000 128 1200 240Z" fill="#9dbde0" opacity=".55"/>' +
        '<path d="M0 240 190 168 380 232 560 148 780 236 960 176 1200 240Z" fill="#7799bf" opacity=".7"/>' +
        '<path d="M0 240 300 202 560 240 840 196 1050 240Z" fill="#54759b" opacity=".85"/>' +
        SVG_END,
    ),
  },
  {
    label: '海浪',
    background: svgCover(
      SVG_START +
        '<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#e6f7ff"/><stop offset="1" stop-color="#b7e2f5"/>' +
        '</linearGradient></defs>' +
        '<rect width="1200" height="240" fill="url(#a)"/>' +
        '<circle cx="960" cy="68" r="32" fill="#ffe9a8"/><circle cx="960" cy="68" r="54" fill="#ffe9a8" opacity=".2"/>' +
        '<path d="M0 168c120-26 220 26 340 8s220-46 340-14 220 40 340 6 180-22 180-22v94H0Z" fill="#93d5ec" opacity=".65"/>' +
        '<path d="M0 196c130-20 230 18 360 4s230-34 360-8 220 30 340 2 140-14 140-14v60H0Z" fill="#5bb8dc" opacity=".7"/>' +
        '<path d="M0 220c150-14 260 12 400 2s240-24 380-4 230 18 420 2v20H0Z" fill="#2f97c4" opacity=".85"/>' +
        SVG_END,
    ),
  },
  {
    label: '星夜',
    background: svgCover(
      SVG_START +
        '<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#17224b"/><stop offset=".6" stop-color="#3c3a75"/><stop offset="1" stop-color="#7b4f86"/>' +
        '</linearGradient></defs>' +
        '<rect width="1200" height="240" fill="url(#a)"/>' +
        '<circle cx="930" cy="64" r="28" fill="#f6ecc4"/><circle cx="930" cy="64" r="46" fill="#f6ecc4" opacity=".14"/>' +
        '<g fill="#fff"><circle cx="120" cy="44" r="1.8" opacity=".9"/><circle cx="260" cy="88" r="1.4" opacity=".7"/>' +
        '<circle cx="380" cy="36" r="2" opacity=".85"/><circle cx="520" cy="72" r="1.3" opacity=".6"/>' +
        '<circle cx="660" cy="40" r="1.8" opacity=".8"/><circle cx="780" cy="96" r="1.2" opacity=".65"/>' +
        '<circle cx="1080" cy="52" r="1.6" opacity=".75"/><circle cx="1130" cy="110" r="1.2" opacity=".6"/>' +
        '<circle cx="180" cy="120" r="1.1" opacity=".5"/></g>' +
        '<path d="M0 210c160-46 300-30 440-6s280 34 420 12 240-26 340-8v32H0Z" fill="#242a52" opacity=".9"/>' +
        '<path d="M0 232c200-26 380 2 560-8s320-24 640-8v24H0Z" fill="#161b3a" opacity=".95"/>' +
        SVG_END,
    ),
  },
  {
    label: '植物',
    background: svgCover(
      SVG_START +
        '<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#eef9ec"/><stop offset="1" stop-color="#d3eed6"/>' +
        '</linearGradient></defs>' +
        '<rect width="1200" height="240" fill="url(#a)"/>' +
        '<path d="M180 240c0-58 26-104 78-132" stroke="#5fae77" stroke-width="6" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="256" cy="96" rx="48" ry="19" fill="#7cc48c" transform="rotate(-36 256 96)"/>' +
        '<ellipse cx="210" cy="150" rx="42" ry="17" fill="#93d3a0" transform="rotate(-18 210 150)"/>' +
        '<path d="M470 240c8-74 44-124 108-158" stroke="#4c9e67" stroke-width="7" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="586" cy="74" rx="56" ry="21" fill="#66b87c" transform="rotate(-40 586 74)"/>' +
        '<ellipse cx="536" cy="132" rx="48" ry="18" fill="#84c997" transform="rotate(-13 536 132)"/>' +
        '<ellipse cx="472" cy="186" rx="42" ry="16" fill="#a5dbb2" transform="rotate(-8 472 186)"/>' +
        '<path d="M900 240c-14-64-2-118 34-158" stroke="#5fae77" stroke-width="6" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="946" cy="76" rx="44" ry="17" fill="#7cc48c" transform="rotate(28 946 76)"/>' +
        '<ellipse cx="924" cy="146" rx="40" ry="15" fill="#98d5a5" transform="rotate(12 924 146)"/>' +
        '<path d="M1090 240c10-48 34-84 68-104" stroke="#4c9e67" stroke-width="5" fill="none" stroke-linecap="round"/>' +
        '<ellipse cx="1160" cy="128" rx="36" ry="14" fill="#8ed1a0" transform="rotate(-30 1160 128)"/>' +
        SVG_END,
    ),
  },
  {
    label: '城市日落',
    background: svgCover(
      SVG_START +
        '<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#ffd9a8"/><stop offset=".62" stop-color="#ff9e83"/><stop offset="1" stop-color="#b46a9e"/>' +
        '</linearGradient></defs>' +
        '<rect width="1200" height="240" fill="url(#a)"/>' +
        '<circle cx="604" cy="148" r="56" fill="#ffefc2" opacity=".95"/><circle cx="604" cy="148" r="82" fill="#ffefc2" opacity=".16"/>' +
        '<g fill="#5a3f72" opacity=".92"><rect x="60" y="128" width="72" height="112"/><rect x="150" y="98" width="52" height="142"/>' +
        '<rect x="220" y="146" width="84" height="94"/><rect x="322" y="118" width="46" height="122"/>' +
        '<rect x="700" y="122" width="70" height="118"/><rect x="788" y="94" width="54" height="146"/>' +
        '<rect x="860" y="140" width="88" height="100"/><rect x="966" y="112" width="48" height="128"/>' +
        '<rect x="1032" y="150" width="108" height="90"/></g>' +
        '<g fill="#ffd98a" opacity=".85"><rect x="76" y="146" width="8" height="10"/><rect x="96" y="166" width="8" height="10"/>' +
        '<rect x="166" y="118" width="7" height="9"/><rect x="182" y="140" width="7" height="9"/>' +
        '<rect x="238" y="162" width="8" height="10"/><rect x="262" y="180" width="8" height="10"/>' +
        '<rect x="716" y="140" width="8" height="10"/><rect x="742" y="162" width="8" height="10"/>' +
        '<rect x="804" y="112" width="7" height="9"/><rect x="876" y="158" width="8" height="10"/>' +
        '<rect x="900" y="180" width="8" height="10"/><rect x="982" y="132" width="7" height="9"/>' +
        '<rect x="1048" y="168" width="8" height="10"/></g>' +
        SVG_END,
    ),
  },
  {
    label: '抽象色块',
    background: svgCover(
      SVG_START +
        '<rect width="1200" height="240" fill="#fdf3f0"/>' +
        '<circle cx="180" cy="60" r="118" fill="#ffd6c9" opacity=".85"/>' +
        '<circle cx="470" cy="200" r="132" fill="#cfe3ff" opacity=".8"/>' +
        '<circle cx="760" cy="60" r="96" fill="#d9f2d0" opacity=".9"/>' +
        '<circle cx="1010" cy="196" r="140" fill="#e9dcff" opacity=".85"/>' +
        '<path d="M980 40c60-30 130-6 140 44s-50 92-110 76-90-90-30-120Z" fill="#ffe6b8" opacity=".7"/>' +
        '<circle cx="620" cy="120" r="26" fill="#ffe0ea" opacity=".9"/>' +
        SVG_END,
    ),
  },
  {
    label: '沙漠',
    background: svgCover(
      SVG_START +
        '<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#fff0cf"/><stop offset="1" stop-color="#ffd39a"/>' +
        '</linearGradient></defs>' +
        '<rect width="1200" height="240" fill="url(#a)"/>' +
        '<circle cx="920" cy="76" r="46" fill="#fff6df"/><circle cx="920" cy="76" r="70" fill="#fff6df" opacity=".18"/>' +
        '<path d="M0 182c180-58 330-18 480 10s330 34 500 2 220-30 220-30v76H0Z" fill="#f2bd7c" opacity=".85"/>' +
        '<path d="M0 214c200-36 380 0 560 12s340-4 640-22v36H0Z" fill="#dd9d5f" opacity=".92"/>' +
        '<path d="M0 234c260-18 480 4 700 6s340-8 500-16v16H0Z" fill="#c78549" opacity=".8"/>' +
        SVG_END,
    ),
  },
  {
    label: '极光',
    background: svgCover(
      SVG_START +
        '<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#0e2440"/><stop offset="1" stop-color="#173f5f"/>' +
        '</linearGradient>' +
        '<linearGradient id="b" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#63f0d0"/><stop offset="1" stop-color="#8f7dff"/>' +
        '</linearGradient></defs>' +
        '<rect width="1200" height="240" fill="url(#a)"/>' +
        '<path d="M0 152c180-92 300 18 460-32s300-58 500 2 240 58 240 58v60H0Z" fill="url(#b)" opacity=".42"/>' +
        '<path d="M0 188c200-70 320 8 500-32s320-38 480 12 220 38 220 38v34H0Z" fill="#6ff0d8" opacity=".2"/>' +
        '<g fill="#fff"><circle cx="150" cy="46" r="1.6" opacity=".8"/><circle cx="320" cy="80" r="1.2" opacity=".6"/>' +
        '<circle cx="520" cy="38" r="1.8" opacity=".75"/><circle cx="740" cy="70" r="1.3" opacity=".6"/>' +
        '<circle cx="980" cy="44" r="1.6" opacity=".7"/><circle cx="1120" cy="92" r="1.2" opacity=".55"/></g>' +
        '<path d="M0 226c220-28 420 2 620-6s360-20 580-14v34H0Z" fill="#0a1b30" opacity=".9"/>' +
        SVG_END,
    ),
  },
]

/** 封面值 → CSS background；空值或无法识别的预设返回空串 */
export function docCoverBackground(cover?: string): string {
  if (!cover) return ''
  if (cover.startsWith('illustration:')) {
    return DOC_COVER_ILLUSTRATIONS[Number(cover.slice('illustration:'.length))]?.background || ''
  }
  if (cover.startsWith('preset:')) return DOC_COVER_PRESETS[Number(cover.slice(7))] || ''
  // 地址里的引号 / 反斜杠转义，避免拼进 url("") 时截断
  const safe = cover.replace(/["\\]/g, (c) => `\\${c}`)
  return `url("${safe}") center / cover no-repeat`
}
