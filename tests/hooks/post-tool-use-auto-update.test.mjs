import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');
const hookScript = join(
  repoRoot,
  'understand-anything-plugin',
  'hooks',
  'post-tool-use-auto-update.mjs',
);

function runHook({
  command = 'git commit -m "test"',
  autoUpdate = true,
  createGraph = true,
} = {}) {
  const projectRoot = mkdtempSync(join(tmpdir(), 'ua-post-tool-use-'));
  const dataDir = join(projectRoot, '.understand-anything');
  mkdirSync(dataDir);
  writeFileSync(join(dataDir, 'config.json'), JSON.stringify({ autoUpdate }));
  if (createGraph) writeFileSync(join(dataDir, 'knowledge-graph.json'), '{}');

  const pluginRoot = join(projectRoot, 'plugin root');
  const result = spawnSync(process.execPath, [hookScript], {
    cwd: projectRoot,
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command },
    }),
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot },
    encoding: 'utf8',
  });

  rmSync(projectRoot, { recursive: true, force: true });
  return { ...result, pluginRoot };
}

describe('PostToolUse auto-update hook', () => {
  it('emits the auto-update instruction after a git commit', () => {
    const result = runHook();

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('[understand-anything] Commit detected');
    expect(result.stdout).toContain(`${result.pluginRoot}/hooks/auto-update-prompt.md`);
  });

  it('stays silent for unrelated Bash commands', () => {
    const result = runHook({ command: 'git status --short' });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('stays silent when automatic updates are disabled', () => {
    const result = runHook({ autoUpdate: false });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});
