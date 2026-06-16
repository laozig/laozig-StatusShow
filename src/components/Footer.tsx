import { parseGitRepo } from "../utils/git"
import { ExternalLink, FolderSync } from 'lucide-react'
import { useLatestVersion } from '../hooks/useLatestVersion'

export function Footer({ text, repo, dist_page }: { text?: string, repo?: string, dist_page?: string }) {
  const { latest, outdated } = useLatestVersion(repo, dist_page)

  const git = repo ? parseGitRepo(repo) : null

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
