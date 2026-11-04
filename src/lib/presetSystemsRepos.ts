import { PresetRepository } from '../types/atlas';

export const SYSTEMS_PRESET_REPOSITORIES: PresetRepository[] = [
  {
    id: 'tauri-desktop-overlay',
    name: 'AegisHUD Desktop Overlay',
    slug: 'aegis-labs/aegis-hud-tauri',
    stackTags: ['Tauri v2', 'Rust IPC', 'React 19 HUD'],
    badge: '2 Advisories',
    badgeTone: 'warning',
    description:
      'Cross-platform Desktop & Wayland/X11 Game Overlay built with Tauri v2, Rust, and React — maps TypeScript `invoke()` calls directly to Rust `#[tauri::command]` handlers and audits IPC sandbox boundaries.',
    files: [
      {
        path: 'src/entry/OverlayApp.tsx',
        content: `import React from 'react';
import { TelemetryHud } from '../features/hud/TelemetryHud';
import { HudPill } from '../components/ui/HudPill';

export function OverlayApp() {
  return (
    <main className="pointer-events-none select-none p-4">
      <HudPill label="RTX 3060 · Wayland" />
      <TelemetryHud />
    </main>
  );
}`,
      },
      {
        path: 'src-tauri/tauri.conf.json',
        content: `{
  "productName": "AegisHUD",
  "version": "2.1.0",
  "app": {
    "windows": [{ "title": "AegisHUD", "transparent": true, "alwaysOnTop": true }],
    "security": { "csp": null }
  }
}`,
      },
      {
        path: 'src/features/hud/TelemetryHud.tsx',
        content: `import React, { useEffect, useState } from 'react';
import { pollGpuMetrics } from '../../services/ipcBridge';
import { GpuFrameStats } from '../../types/telemetry';

export function TelemetryHud() {
  const [stats, setStats] = useState<GpuFrameStats | null>(null);
  useEffect(() => { pollGpuMetrics().then(setStats); }, []);
  return <div>{stats ? \`\${stats.fps} FPS · \${stats.vramMb} MB\` : 'Syncing...'}</div>;
}`,
      },
      {
        path: 'src/services/ipcBridge.ts',
        content: `import { GpuFrameStats } from '../types/telemetry';
import { invoke } from '@tauri-apps/api/core';

export async function pollGpuMetrics(): Promise<GpuFrameStats> {
  return invoke<GpuFrameStats>('poll_gpu_metrics');
}`,
      },
      {
        path: 'src-tauri/src/capture.rs',
        content: `#[tauri::command]
pub fn poll_gpu_metrics(nvml_ptr: *mut u32) -> u32 {
    // Raw FFI dereference without safety invariant comment (PERF-006)
    unsafe { *nvml_ptr = 144; }
    144
}`,
      },
      {
        path: 'src/components/ui/HudPill.tsx',
        content: `import React from 'react';
export function HudPill({ label }: { label: string }) {
  return <span className="px-2 py-0.5 text-xs font-mono rounded">{label}</span>;
}`,
      },
      {
        path: 'src/types/telemetry.ts',
        content: `export interface GpuFrameStats {
  fps: number;
  frametimeMs: number;
  vramMb: number;
}`,
      },
    ],
  },
  {
    id: 'linux-kernel-sched',
    name: 'Linux Kernel Scheduler & eBPF',
    slug: 'torvalds/linux/kernel/sched',
    stackTags: ['C11 Kernel', 'Rust for Linux', 'eBPF'],
    badge: '3 Advisories',
    badgeTone: 'warning',
    description:
      'Stratified C11 & Rust-for-Linux subsystem slice of the Linux Kernel (`kernel/sched`, `kernel/bpf`, `rust/kernel`) demonstrating `#include` & `use kernel::` AST resolution, buffer bounds auditing, and spin-delay detection.',
    files: [
      {
        path: 'init/main.c',
        content: `#include <linux/sched.h>
#include "../kernel/sched/sched.h"

void start_kernel(void) {
  sched_init();
  bpf_subsystem_init();
}`,
      },
      {
        path: 'kernel/sched/core.c',
        content: `#include <linux/sched.h>
#include "sched.h"

void sched_init(void) { init_cfs_rq(); }
void sched_throttle_rq(struct rq *rq) {
  // Hard CPU busy-wait stalling hardware core (PERF-006)
  mdelay(15);
  enqueue_task_fair(rq);
}`,
      },
      {
        path: 'kernel/sched/fair.c',
        content: `#include <linux/sched.h>
#include "sched.h"

void init_cfs_rq(void) {}
void enqueue_task_fair(struct rq *rq) { update_curr(rq); }`,
      },
      {
        path: 'kernel/bpf/syscall.c',
        content: `#include <linux/sched.h>
#include "../sched/sched.h"

int bpf_prog_load_name(char *dst_name, const char *user_prog_tag) {
  // Unbounded C string copy into fixed kernel buffer (SEC-006)
  sprintf(dst_name, "bpf_prog_%s", user_prog_tag);
  return 0;
}`,
      },
      {
        path: 'rust/kernel/sync.rs',
        content: `pub struct SpinLock<T> { data: T }

impl<T> SpinLock<T> {
    pub fn lock_raw(&mut self, ptr: *mut u64) {
        // Raw pointer dereference inside spinlock without invariant annotation (PERF-006)
        unsafe { *ptr = 1; }
    }
}`,
      },
      {
        path: 'kernel/sched/sched.h',
        content: `#ifndef _KERNEL_SCHED_SCHED_H
#define _KERNEL_SCHED_SCHED_H
#include <linux/sched.h>

struct rq { unsigned int nr_running; u64 clock_task; };
void init_cfs_rq(void);
void enqueue_task_fair(struct rq *rq);
void update_curr(struct rq *rq);
#endif`,
      },
      {
        path: 'include/linux/sched.h',
        content: `#ifndef _LINUX_SCHED_H
#define _LINUX_SCHED_H
typedef unsigned long long u64;
struct task_struct { int pid; int prio; char comm[16]; };
void sched_init(void);
void bpf_subsystem_init(void);
#endif`,
      },
      {
        path: 'kernel/Kconfig.hz',
        content: `config HZ_1000
  bool "1000 HZ"`,
      },
    ],
  },
];
