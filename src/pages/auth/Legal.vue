<template>
  <div class="legal-page">
    <article class="legal-card">
      <h1 class="legal-title">{{ doc.title }}</h1>
      <p class="legal-meta">更新日期：{{ doc.updatedAt }} · 生效日期：{{ doc.updatedAt }}</p>
      <section v-for="(s, i) in doc.sections" :key="i" class="legal-section">
        <h2 class="legal-heading">{{ i + 1 }}. {{ s.heading }}</h2>
        <p v-for="(p, j) in s.paragraphs" :key="j" class="legal-text">{{ p }}</p>
      </section>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

interface LegalSection { heading: string; paragraphs: string[] }
interface LegalDoc { title: string; updatedAt: string; sections: LegalSection[] }

/** 方括号内为需要替换的信息（公司主体、联系方式、管辖法院等），上线前请法务审核 */
const DOCS: Record<'terms' | 'privacy', LegalDoc> = {
  terms: {
    title: '服务协议',
    updatedAt: '2026 年 11 月 20 日',
    sections: [
      {
        heading: '总则',
        paragraphs: [
          '本协议是您与 [公司名称]（以下简称“我们”）之间关于使用需求管控平台（以下简称“本服务”）的约定。您注册、登录或使用本服务，即表示您已阅读、理解并同意本协议的全部内容。',
        ],
      },
      {
        heading: '账号注册与安全',
        paragraphs: [
          '您应使用真实有效的邮箱注册，并通过邮箱验证码完成验证。注册时请妥善设置密码，并对账号下的所有操作负责。',
          '您不得转让、出借或与他人共用账号。发现账号被未经授权使用时，应立即修改密码并通知我们。',
        ],
      },
      {
        heading: '服务内容',
        paragraphs: [
          '本服务包括事项（需求 / 任务）管理、看板与待办、空间与组织协作、云文档与知识库等功能。我们可根据业务需要调整、增加或下线部分功能；重大变更会提前通知。',
        ],
      },
      {
        heading: '用户行为规范',
        paragraphs: [
          '您不得利用本服务发布或传播违法、侵犯他人合法权益、含有恶意代码或其他有害的内容。',
          '您不得干扰、破坏本服务的正常运行，不得尝试未经授权访问系统、其他用户的数据或内部接口。',
        ],
      },
      {
        heading: '用户内容',
        paragraphs: [
          '您在本服务中创建或上传的内容（如事项、文档、附件）的权利归您或相关权利人所有。您授权我们在提供、维护和保障本服务所必需的范围内存储、处理和展示这些内容。',
          '除依法要求或经您同意外，我们不会向第三方公开您的内容。',
        ],
      },
      {
        heading: '知识产权',
        paragraphs: [
          '本服务的软件、界面设计、商标及相关标识归我们或相应权利人所有。未经许可，您不得复制、修改、反向工程或以其他方式擅自使用。',
        ],
      },
      {
        heading: '服务的变更、中断与终止',
        paragraphs: [
          '因系统维护、故障、网络原因或不可抗力，本服务可能出现中断或延迟，我们将尽力及时恢复。',
          '如您违反本协议，我们有权警告、限制功能或停用账号。您可随时申请注销账号。',
        ],
      },
      {
        heading: '责任限制',
        paragraphs: [
          '在法律允许的最大范围内，我们不对间接损失、利润损失或数据丢失承担责任，但因我们的故意或重大过失造成的损失除外。因您违反本协议造成的损失，由您自行承担。',
        ],
      },
      {
        heading: '协议修改',
        paragraphs: [
          '我们可能根据业务或法律要求修改本协议。修改后的协议将在本服务内公告，公告生效后您继续使用本服务，即视为接受修改后的协议。',
        ],
      },
      {
        heading: '适用法律与争议解决',
        paragraphs: [
          '本协议适用中华人民共和国法律。因本协议引起的争议，双方应先协商解决；协商不成的，任一方可向 [管辖法院] 提起诉讼。',
        ],
      },
      {
        heading: '联系我们',
        paragraphs: ['如对本协议有任何疑问，请通过 [联系邮箱] 与我们联系。'],
      },
    ],
  },
  privacy: {
    title: '隐私政策',
    updatedAt: '2026 年 11 月 20 日',
    sections: [
      {
        heading: '我们收集的信息',
        paragraphs: [
          '账号信息：注册时提供的邮箱、姓名（选填）。密码以加密（哈希）形式存储，我们无法查看您的明文密码。',
          '验证码信息：注册时发送至您邮箱的验证码仅用于身份验证，在有效期及校验完成后失效，不作长期保存。',
          '使用信息：登录时间、操作记录及事项变更记录，用于安全防护和问题追溯。',
          '内容信息：您在本服务中主动提交的事项、文档、评论及附件。',
        ],
      },
      {
        heading: '信息的使用目的',
        paragraphs: [
          '用于完成注册与身份验证、提供和维护本服务、保障账号与系统安全、处理您的咨询或投诉，以及依法履行义务。',
        ],
      },
      {
        heading: '信息的存储与安全',
        paragraphs: [
          '您的信息存储于 [存储地区及服务商] 的服务器中。我们采取访问控制、加密存储等技术和管理措施保护您的信息，但任何安全措施都无法保证绝对安全。',
        ],
      },
      {
        heading: '信息的共享',
        paragraphs: [
          '我们不会出售您的个人信息。除以下情形外，我们不会向第三方提供您的信息：取得您的明确同意；法律法规要求；为提供服务所必需（例如由邮件服务商发送验证码，仅提供收件邮箱和验证码内容）。',
        ],
      },
      {
        heading: 'Cookie 与本地存储',
        paragraphs: [
          '我们使用 Cookie 及浏览器本地存储保持登录状态，并在您选择时记住账号。您可以通过浏览器设置清除这些数据，但可能需要重新登录。',
        ],
      },
      {
        heading: '信息的保存期限',
        paragraphs: [
          '账号存续期间，我们会保存您的账号信息及相关业务数据。您注销账号后，我们将在法律允许的期限内删除或匿名化处理相关信息。',
        ],
      },
      {
        heading: '您的权利',
        paragraphs: [
          '您有权查询、更正您的个人信息，并在符合条件时要求删除信息或撤回同意（撤回同意可能导致部分服务无法使用）。您可通过 [联系邮箱] 行使上述权利。',
        ],
      },
      {
        heading: '未成年人保护',
        paragraphs: ['本服务不面向未满 14 周岁的未成年人。如发现未成年人在未经监护人同意的情况下提供了个人信息，请与我们联系删除。'],
      },
      {
        heading: '政策更新',
        paragraphs: ['我们可能不时更新本隐私政策，更新后会在本服务内公告。重大变更将以适当方式再次征求您的同意。'],
      },
      {
        heading: '联系我们',
        paragraphs: ['如对本隐私政策有任何疑问或投诉，请通过 [联系邮箱] 与我们联系。'],
      },
    ],
  },
}

const route = useRoute()
const doc = computed<LegalDoc>(() => DOCS[(route.meta.doc as 'terms' | 'privacy') ?? 'terms'])
</script>

<style scoped>
.legal-page {
  min-height: 100dvh;
  padding: 40px 16px;
  box-sizing: border-box;
  background: #f5f4f0;
}

.legal-card {
  max-width: 800px;
  margin: 0 auto;
  padding: 36px 40px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
  color: #1a1a1a;
}

.legal-title {
  margin: 0 0 6px;
  font-size: 24px;
  font-weight: 600;
}

.legal-meta {
  margin: 0 0 24px;
  font-size: 13px;
  color: #8a8880;
}

.legal-section + .legal-section {
  margin-top: 20px;
}

.legal-heading {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}

.legal-text {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.75;
  color: #3d3c38;
}

@media (max-width: 600px) {
  .legal-card {
    padding: 24px 20px;
  }
}
</style>
