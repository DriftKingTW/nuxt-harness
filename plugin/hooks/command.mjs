// Shared by the Bash hooks: whether a command line runs `gh pr <sub>`, ignoring the same words in
// heredoc bodies and quoted strings (a commit message may mention them).
const HEREDOC = /<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g
const QUOTED = /'[^']*'|"(?:[^"\\]|\\.)*"/g

/** The command line without heredoc bodies and quoted strings. */
export function codeOnly(command) {
  return command.replace(HEREDOC, m => m.split('\n')[0]).replace(QUOTED, '""')
}

/** True when `gh pr <sub>` runs as a command: at the start, or after ; && || | ( or a newline. */
export function runsGhPr(command, sub) {
  return new RegExp(`(?:^|[;&|(\\n])\\s*(?:\\w+=\\S*\\s+)*gh\\s+pr\\s+${sub}\\b`).test(codeOnly(command))
}
