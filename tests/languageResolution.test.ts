import { describe, expect, it } from 'bun:test';
import { analyzeRepository } from '../src/lib/analyzer';
import { isAnalyzablePath, selectStratifiedPaths } from '../src/lib/githubFetcher';
import { extractImports, resolveImportToFile } from '../src/lib/importResolver';
import { runSecurityAudit } from '../src/lib/securityAuditor';

describe('Language-specific import resolution', () => {
  it('resolves Rust grouped, glob, super and self imports relative to the module tree', () => {
    const code = [
      'use crate::{config::Config, error::{Error, Result}};',
      'use super::*;',
      'use self::inner::Thing as T;',
      'pub(crate) use crate::util;',
      'mod walk;',
      'use std::io;',
    ].join('\n');
    const from = 'src/a/b.rs';
    const paths = ['src/lib.rs', 'src/config.rs', 'src/error/mod.rs', 'src/a.rs', from, 'src/a/b/inner.rs', 'src/a/b/walk.rs', 'src/util.rs'];
    const resolved = extractImports(code, from).map((s) => resolveImportToFile(from, s, paths));
    expect(resolved).toEqual(['src/config.rs', 'src/error/mod.rs', 'src/a.rs', 'src/a/b/inner.rs', 'src/util.rs', 'src/a/b/walk.rs']);
  });

  it('maps Go module imports through go.mod and links files inside one package by symbol use', () => {
    const files = [
      { path: 'go.mod', content: 'module github.com/acme/tool\n\ngo 1.22\n' },
      { path: 'command.go', content: 'package tool\n\ntype Command struct{ Use string }\n\nfunc (c *Command) Run() { runHooks(c) }\n' },
      { path: 'hooks.go', content: 'package tool\n\nfunc runHooks(c *Command) {}\n' },
      { path: 'doc/gen.go', content: 'package doc\n\nimport "github.com/acme/tool"\n\nfunc Gen(c *tool.Command) {}\n' },
      { path: 'cmd/tool/main.go', content: 'package main\n\nimport (\n\t"fmt"\n\t"github.com/acme/tool/doc"\n)\n\nfunc main() { fmt.Println(doc.Gen) }\n' },
    ];
    const r = analyzeRepository('tool', '', 'test', files);
    const edge = (from: string, to: string) => r.edges.some((e) => e.from === from && e.to === to);
    expect(edge('doc/gen.go', 'command.go')).toBe(true); // root package `github.com/acme/tool`
    expect(edge('cmd/tool/main.go', 'doc/gen.go')).toBe(true);
    expect(edge('command.go', 'hooks.go')).toBe(true);
    expect(edge('hooks.go', 'command.go')).toBe(true);
    expect(r.scores.circularDepsCount).toBe(0); // intra-package references are legal in Go
    expect(r.nodes.find((n) => n.path === 'cmd/tool/main.go')?.layer).toBe('entry');
    expect(r.nodes.find((n) => n.path === 'hooks.go')?.layer).toBe('service');
  });

  it('resolves Python `from pkg import name` to the submodule when one exists, else to the package', () => {
    const files = [
      { path: 'fastapi/__init__.py', content: 'from .applications import FastAPI as FastAPI\nfrom .routing import *\n' },
      { path: 'fastapi/applications.py', content: 'from fastapi import params, routing\nfrom fastapi import FastAPI\nimport os, fastapi.routing\n' },
      { path: 'fastapi/params.py', content: 'x = 1\n' },
      { path: 'fastapi/routing.py', content: 'y = 2\n' },
      { path: 'fastapi/json/__init__.py', content: 'from .provider import dumps\n' },
      { path: 'fastapi/json/provider.py', content: 'import json\nimport typing as t\n' },
    ];
    const r = analyzeRepository('fastapi', '', 'test', files);
    const targets = (from: string) => r.edges.filter((e) => e.from === from).map((e) => e.to).sort();
    expect(targets('fastapi/applications.py')).toEqual(['fastapi/__init__.py', 'fastapi/params.py', 'fastapi/routing.py']);
    expect(targets('fastapi/__init__.py')).toEqual(['fastapi/applications.py', 'fastapi/routing.py']);
    expect(targets('fastapi/json/provider.py')).toEqual([]); // stdlib `json`, not the local fastapi/json package
    // a CapWords re-export from the own package's __init__ is a genuine circular import
    expect(r.findings.filter((f) => f.ruleId === 'ARCH-002')).toHaveLength(1);
  });

  it('does not report Rust crate-root re-exports as layer inversions', () => {
    const files = [
      { path: 'src/lib.rs', content: 'mod types;\npub struct Error;\n' },
      { path: 'src/types.rs', content: 'use crate::{Error};\npub struct Glob;\n' },
    ];
    const r = analyzeRepository('crate', '', 'test', files);
    expect(r.edges.some((e) => e.from === 'src/types.rs' && e.to === 'src/lib.rs')).toBe(true);
    expect(r.findings.filter((f) => f.ruleId === 'ARCH-003')).toHaveLength(0);
  });
});

describe('TypeScript import elision', () => {
  it('treats imports used only as types as erased, but keeps value usages as runtime edges', () => {
    const files = [
      { path: 'src/menu.ts', content: "export interface MenuOptions { id: string }\nexport * from './menu/kinds'\nexport * from './menu/menu'\n" },
      { path: 'src/menu/kinds.ts', content: "export type Kind = 'a'\n" },
      { path: 'src/menu/menu.ts', content: "import { MenuOptions, Kind } from '../menu'\nexport class Menu {}\n" },
      { path: 'src/image.ts', content: "import { NativeIcon } from './menu/icon'\nexport function load() { return NativeIcon.Add }\n" },
      { path: 'src/badge.ts', content: "import { NativeIcon } from './menu/icon'\nexport type BadgeIcon = string | NativeIcon\n" },
      { path: 'src/barrel.ts', content: "export { NativeIcon } from './menu/icon'\n" },
      { path: 'src/menu/icon.ts', content: "import { load as loadImage } from '../image'\nexport enum NativeIcon { Add }\nexport const preload = () => loadImage()\n" },
    ];
    const r = analyzeRepository('t', '', 'test', files);
    expect(r.edges.find((e) => e.from === 'src/menu/menu.ts')?.typeOnly).toBe(true);
    expect(r.edges.find((e) => e.from === 'src/badge.ts')?.typeOnly).toBe(true); // enum used only as a type
    expect(r.edges.find((e) => e.from === 'src/image.ts')?.typeOnly).toBe(false);
    expect(r.edges.find((e) => e.from === 'src/barrel.ts')?.typeOnly).toBe(false); // re-exported enum is a value
    const cycles = r.findings.filter((f) => f.ruleId === 'ARCH-002');
    expect(cycles).toHaveLength(1);
    expect(cycles[0].codeSnippet).toContain('src/image.ts');
  });
});

describe('Sampling and rule precision', () => {
  it('skips docs, templates and type-test folders but keeps go.mod', () => {
    expect(isAnalyzablePath('docs_src/tutorial001.py')).toBe(false);
    expect(isAnalyzablePath('crates/cli/templates/app/src/main.rs')).toBe(false);
    expect(isAnalyzablePath('test-d/hooks.ts')).toBe(false);
    expect(isAnalyzablePath('integration-tests/run.ts')).toBe(false);
    expect(isAnalyzablePath('go.mod')).toBe(true);
    expect(isAnalyzablePath('fastapi/routing.py')).toBe(true);
  });

  it('always keeps pinned manifests and prefers the package folder named after the repo', () => {
    const items = [
      ...Array.from({ length: 40 }, (_, i) => ({ path: `misc/tools/t${i}.py` })),
      ...Array.from({ length: 20 }, (_, i) => ({ path: `fastapi/m${i}.py` })),
      { path: 'go.mod' },
    ];
    const picked = selectStratifiedPaths(items, 12, 'fastapi').map((i) => i.path);
    expect(picked).toContain('go.mod');
    expect(picked.filter((p) => p.startsWith('fastapi/')).length).toBeGreaterThanOrEqual(9);
  });

  it('does not flag strcpy of a short string literal', () => {
    const findings = runSecurityAudit([
      { path: 'a.c', content: 'void f(char *b) {\n  strcpy(b - 1, "...");\n}\n' },
      { path: 'b.c', content: 'void g(char *b, const char *s) {\n  strcpy(b, s);\n}\n' },
      { path: 'fmacros.h', content: 'int sprintf(char *str, const char *format, ...) __attribute__((deprecated("use snprintf")));\n' },
    ]);
    expect(findings.map((f) => f.filePath)).toEqual(['b.c']);
  });
});
