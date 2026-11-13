<template>
  <!-- 云文档 logo：简约小蜜蜂 -->
  <svg
    viewBox="0 0 48 48"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="云文档"
  >
    <defs>
      <clipPath id="beeBodyClip">
        <rect x="13" y="16" width="22" height="26" rx="11" />
      </clipPath>
    </defs>

    <!-- 触角 -->
    <path d="M20 12.5c-1.2-3-3-4.8-5-5.2" stroke="#92400e" stroke-width="2" stroke-linecap="round" fill="none" />
    <path d="M28 12.5c1.2-3 3-4.8 5-5.2" stroke="#92400e" stroke-width="2" stroke-linecap="round" fill="none" />
    <circle cx="14.6" cy="6.8" r="1.8" fill="#92400e" />
    <circle cx="33.4" cy="6.8" r="1.8" fill="#92400e" />

    <!-- 翅膀 -->
    <ellipse cx="13.5" cy="22" rx="7" ry="10" fill="#dbeafe" opacity="0.9" transform="rotate(-28 13.5 22)" />
    <ellipse cx="34.5" cy="22" rx="7" ry="10" fill="#dbeafe" opacity="0.9" transform="rotate(28 34.5 22)" />

    <!-- 身体 -->
    <rect x="13" y="16" width="22" height="26" rx="11" fill="#fbbf24" />
    <!-- 条纹（裁剪在身体内） -->
    <g clip-path="url(#beeBodyClip)">
      <rect x="13" y="23" width="22" height="4" fill="#92400e" />
      <rect x="13" y="30.5" width="22" height="4" fill="#92400e" />
    </g>

    <!-- 眼睛 -->
    <circle cx="19.5" cy="19.5" r="1.7" fill="#1f2329" />
    <circle cx="28.5" cy="19.5" r="1.7" fill="#1f2329" />
  </svg>
</template>
