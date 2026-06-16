import { useState } from 'react'
import { Sparkles, X, RefreshCw, GitCommitHorizontal } from 'lucide-react'
import { useLatestVersion } from '../hooks/useLatestVersion'
import { parseGitRepo } from '../utils/git'

const DISMISS_KEY = 'nodeget.dismissedVersion'
const trimSlash = (s: string) => s.replace(/\/$/, '')

/** 右下角浮动更新提示:发现比当前构建更新的版本时出现,可关闭(同版本不再打扰)。 */
export function UpdateNotice({ repo, distPage }: { repo?: string; distPage?: string }) {
  const { current, latest, outdated } = useLatestVersion(repo, distPage)
  const [dismissed, setDismissed] = useState<string | null>(() => localStorage.getItem(DISMISS_KEY))

  if (!outdated || !latest || dismissed === latest) return null

  const git = repo ? parseGitRepo(repo) : null
  const changelogUrl = git ? `https://github.com/${git.user}/${git.repo}/commits/main` : repo
  // 主操作:跳到 NodeGet 主控重新拉取本主题的最新版(一键更新);无 dist_page 时回退到 zip / releases
  const dashUrl = distPage
    ? `https://dash.nodeget.com/#/dashboard/theme-management?add=${trimSlash(distPage)}`
    : null
  const zipUrl = distPage
    ? `${trimSlash(distPage)}/NodeGet-StatusShow.zip?version=v${latest}`
    : repo
      ? `${repo}/releases`
      : null
  const updateUrl = dashUrl || zipUrl
  const updateLabel = dashUrl ? '一键更新' : '下载新版'

  const close = () => {
    localStorage.setItem(DISMISS_KEY, latest)
    setDismissed(latest)
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-72 max-w-[calc(100vw-2.5rem)] card-glass rounded-2xl p-4 shadow-xl animate-slide-up">
      <button
        onClick={close}
        aria-label="忽略此版本"
        title="忽略此版本"
        className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex items-center gap-2 text-primary font-semibold text-sm">
        <Sparkles className="h-4 w-4" />
        发现新版本
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground">
        当前 <span className="font-mono">v{current}</span>
        <span className="mx-1">→</span>
        最新 <span className="font-mono text-foreground font-medium">v{latest}</span>
      </p>

      <div className="mt-3 flex gap-2">
        {changelogUrl && (
          <a
            href={changelogUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs hover:border-primary/50 hover:text-primary transition-colors"
          >
            <GitCommitHorizontal className="h-3.5 w-3.5" />
            更新内容
          </a>
        )}
        {updateUrl && (
          <a
            href={updateUrl}
            target="_blank"
            rel="noreferrer"
            className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {updateLabel}
          </a>
        )}
      </div>
    </div>
  )
}
