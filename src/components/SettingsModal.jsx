import { useState } from 'react'

const TABS = [
  { key: 'claude', label: 'Claude', storageKey: 'vab_api_key', placeholder: 'sk-ant-...', type: 'password' },
  { key: 'slack', label: 'Slack', storageKey: 'vab_slack_webhook', placeholder: 'https://hooks.slack.com/services/...', type: 'text' },
  { key: 'github', label: 'GitHub', storageKey: 'vab_github_token', placeholder: 'ghp_...', type: 'password' },
  { key: 'email', label: 'Email', storageKey: 'vab_resend_key', placeholder: 're_...', type: 'password' },
  { key: 'gsheets', label: 'Sheets', storageKey: 'vab_gsheets_key', placeholder: 'AIza...', type: 'password' }
]

const HELP_TEXT = {
  claude: 'Your key is stored in your browser only and never sent anywhere else.',
  slack: 'Create a webhook at api.slack.com/apps → Incoming Webhooks.',
  github: 'Create a token at github.com/settings/tokens with repo scope.',
  email: 'Get your API key at resend.com/api-keys.',
  gsheets: 'Get an API key at console.cloud.google.com. Your spreadsheet must be shared with "Anyone with the link" for API key access to work.'
}

export function SettingsModal({ onSave }) {
  const [activeTab, setActiveTab] = useState('claude')
  const [values, setValues] = useState(() => {
    const initial = {}
    for (const tab of TABS) {
      initial[tab.key] = localStorage.getItem(tab.storageKey) || ''
    }
    return initial
  })

  const activeTabDef = TABS.find(t => t.key === activeTab)
  const claudeKey = values.claude
  const isClaudeValid = claudeKey.startsWith('sk-ant-') && claudeKey.length > 20

  const handleSave = () => {
    for (const tab of TABS) {
      const val = values[tab.key]
      if (val) {
        localStorage.setItem(tab.storageKey, val)
      } else {
        localStorage.removeItem(tab.storageKey)
      }
    }
    if (isClaudeValid) {
      onSave(claudeKey)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-[28rem] shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Settings</h2>

        <div className="flex gap-1 mb-4 border-b border-gray-200">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <p className="text-sm text-gray-500 mb-3">{HELP_TEXT[activeTab]}</p>

        <input
          type={activeTabDef.type}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder={activeTabDef.placeholder}
          value={values[activeTab]}
          onChange={e => setValues(prev => ({ ...prev, [activeTab]: e.target.value }))}
          autoFocus
        />

        <button
          className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          disabled={!isClaudeValid && !localStorage.getItem('vab_api_key')}
          onClick={handleSave}
        >
          Save & Continue
        </button>
      </div>
    </div>
  )
}
