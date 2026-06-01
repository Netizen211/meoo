import React from 'react';
import { useNavigate } from 'react-router-dom';

interface Section {
  title: string;
  content: string[];
}

interface LegalContent {
  title: string;
  sections: Section[];
}

const termsContent: LegalContent = {
  title: '服务条款',
  sections: [
    {
      title: '1. 服务说明',
      content: ['店分析（以下简称"本服务"）是一款拼多多店铺数据分析工具，帮助商家对订单、推广、售后、财务等数据进行汇总、计算和可视化分析。'],
    },
    {
      title: '2. 用户注册与账号',
      content: [
        '2.1 用户需通过有效邮箱注册账号。注册即表示同意本条款。',
        '2.2 用户应妥善保管账号密码，因密码泄露导致的损失由用户自行承担。',
      ],
    },
    {
      title: '3. 数据上传与使用',
      content: [
        '3.1 用户上传的数据仅用于本服务的分析功能。',
        '3.2 用户承诺上传的数据不包含任何个人隐私信息（如消费者姓名、电话、地址等）。',
        '3.3 本服务不会将用户数据出售、转让或用于其他商业用途。',
      ],
    },
    {
      title: '4. 费用说明',
      content: [
        '4.1 本服务提供免费试用期，具体以页面公示为准。',
        '4.2 超出免费额度后需付费使用，收费标准详见会员中心页面。',
      ],
    },
    {
      title: '5. 免责声明',
      content: [
        '5.1 本服务按"现状"提供，分析结果仅供参考，不构成经营决策建议。',
        '5.2 因不可抗力、网络故障等原因导致服务中断，本服务不承担责任。',
      ],
    },
    {
      title: '6. 联系方式',
      content: ['如有疑问，请联系客服支持。'],
    },
  ],
};

const privacyContent: LegalContent = {
  title: '隐私政策',
  sections: [
    {
      title: '1. 信息收集',
      content: [
        '1.1 注册信息：您注册时提供的邮箱地址，用于账号识别和密码找回。',
        '1.2 店铺数据：您上传的订单、推广、售后、财务等拼多多导出数据，用于为您提供数据分析服务。',
        '1.3 我们不会收集您的个人身份信息、支付信息或浏览器指纹。',
      ],
    },
    {
      title: '2. 信息使用',
      content: [
        '2.1 您的数据仅用于本服务内的分析和展示功能。',
        '2.2 我们不会将您的数据用于广告推送、用户画像或其他商业目的。',
        '2.3 我们不会将您的数据分享、出售或转让给任何第三方。',
      ],
    },
    {
      title: '3. 数据存储',
      content: [
        '3.1 您的所有数据均存储在云端服务器，确保数据安全与多设备同步。',
        '3.2 数据通过 HTTPS 加密传输，采用 JWT 认证保护您的账户安全。',
        '3.3 您可在设置页面随时删除店铺数据，操作即时生效不可恢复。',
      ],
    },
    {
      title: '4. 数据安全',
      content: [
        '4.1 数据传输采用 HTTPS 加密，云端存储采用数据库隔离机制。',
        '4.2 我们采取合理的安全措施保护您的数据不受未经授权的访问。',
      ],
    },
    {
      title: '5. 用户权利',
      content: [
        '5.1 您有权随时导出、删除自己的全部数据。',
        '5.2 您有权注销账号，注销后所有关联数据将被永久删除。',
      ],
    },
    {
      title: '6. 免责声明',
      content: [
        '6.1 请您在上传数据前自行脱敏处理（移除消费者姓名、电话、地址等隐私信息）。',
        '6.2 因用户未脱敏上传导致的隐私泄露，本服务不承担责任。',
      ],
    },
    {
      title: '7. 政策更新',
      content: ['本政策可能不时更新，更新后将在页面上公布。继续使用服务即表示接受更新后的政策。'],
    },
  ],
};

type LegalType = 'terms' | 'privacy';

export const LegalPage: React.FC<{ type: LegalType }> = ({ type }) => {
  const navigate = useNavigate();
  const content = type === 'terms' ? termsContent : privacyContent;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f5f5f5',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      color: '#333',
      lineHeight: 1.8,
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 20,
            padding: '8px 16px',
            background: '#fff',
            border: '1px solid #e5e5e5',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 14,
            color: '#666',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#e02e24'; e.currentTarget.style.color = '#e02e24'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e5e5'; e.currentTarget.style.color = '#666'; }}
        >
          ← 返回
        </button>

        <div style={{
          background: '#fff',
          borderRadius: 12,
          padding: 40,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <h1 style={{ fontSize: 24, marginBottom: 8, color: '#1a1a1a' }}>{content.title}</h1>
          <p style={{ fontSize: 13, color: '#999', marginBottom: 32 }}>最后更新日期：2026年5月1日</p>

          {content.sections.map((section, idx) => (
            <div key={idx}>
              <h2 style={{ fontSize: 18, margin: '28px 0 12px', color: '#1a1a1a' }}>{section.title}</h2>
              {section.content.map((paragraph, pIdx) => (
                <p key={pIdx} style={{ fontSize: 15, color: '#555', marginBottom: 12 }}>{paragraph}</p>
              ))}
            </div>
          ))}

          <div style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: '#999' }}>
            © 2026 店分析 版权所有
          </div>
        </div>
      </div>
    </div>
  );
};

export const TermsPage: React.FC = () => <LegalPage type="terms" />;
export const PrivacyPage: React.FC = () => <LegalPage type="privacy" />;
