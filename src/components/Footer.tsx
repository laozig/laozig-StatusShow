import { useEffect, useState } from 'react'
import { parseGitRepo } from "../utils/git"
import { ExternalLink, HardDriveDownload, FolderSync } from 'lucide-react'

export function Footer({ text, repo, dist_page }: { text?: string, repo?: string, dist_page?: string }) {
  const [latest, setLatest] = useState<string | null>(null)

  const git = repo ? parseGitRepo(repo) : null
  const PKG_URL = git
    ? `https://raw.githubusercontent.com/${git.user}/${git.repo}/main/package.json`
    : null

  useEffect(() => {
    if (!PKG_URL) return
    fetch(PKG_URL)
      .then(r => (r.ok ? r.json() : null))
      .then(j => j?.version && setLatest(String(j.version)))
      .catch(() => { })
  }, [PKG_URL])

  const outdated = latest != null && latest !== __APP_VERSION__
  const laststDist = dist_page
    ? `${dist_page}/NodeGet-StatusShow.zip?version=v${latest}`
    : repo
      ? `${repo}/releases`
      : null

  return (
    <footer className="border-t border-border/50 backdrop-blur-sm bg-background/50">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-end gap-3 text-xs text-muted-foreground">
        <span className="mr-auto">
          {text || 'Powered by NodeGet'}
          {git && (
            <a
              href={repo}
              target="_blank"
              rel="noreferrer"
              className="ml-2 hover:text-primary transition-colors"
            >
              <ExternalLink className="inline-block w-3 h-3" />
            </a>
          )}
        </span>
        <a
          href="download.html"
          target="_blank"
          rel="noreferrer"
          className="flex items-center hover:text-primary transition-colors"
        >
          <HardDriveDownload className="inline-block w-3 h-3 mr-1" />
          提取主题
        </a>
        {outdated && laststDist && (
          <a
            href={laststDist}
            target="_blank"
            rel="noreferrer"
            className="flex items-center hover:text-primary transition-colors ml-2 text-destructive"
          >
            <FolderSync className="inline-block w-3 h-3 mr-1" />
            升级到 v{latest}
          </a>
        )}
      </div>
    </footer>
  )
}
