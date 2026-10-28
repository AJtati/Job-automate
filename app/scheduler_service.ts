import { CandidateProfile, ProfileScheduleConfig, ProfilesManager } from "./profiles_manager";

export interface ScrapeExecutionResult {
  foundCount: number;
  addedCount: number;
  error?: string;
  sourceBreakdown?: Array<{ source: string; found: number; added: number; status: string }>;
}

export type ScrapeRunner = (profile: CandidateProfile) => Promise<ScrapeExecutionResult>;

export function isScheduleDue(schedule?: ProfileScheduleConfig, now: Date = new Date()): boolean {
  if (!schedule || !schedule.enabled) return false;

  if (schedule.nextRunAt) {
    const nextTime = new Date(schedule.nextRunAt).getTime();
    if (!isNaN(nextTime)) {
      return now.getTime() >= nextTime;
    }
  }

  if (schedule.mode === "interval") {
    const hours = Math.max(1, schedule.intervalHours || 4);
    if (!schedule.lastRunAt) return false;
    const lastRun = new Date(schedule.lastRunAt).getTime();
    if (isNaN(lastRun)) return false;
    return (now.getTime() - lastRun) >= (hours * 3600 * 1000);
  }

  if (schedule.mode === "daily") {
    const timeParts = (schedule.dailyTime || "08:00").split(":");
    const h = parseInt(timeParts[0] || "8", 10);
    const m = parseInt(timeParts[1] || "0", 10);
    const targetToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);

    // If now is before today's target time, not due yet
    if (now.getTime() < targetToday.getTime()) return false;

    // Now is on or after today's target time.
    // Check if it already ran today on or after targetToday
    if (schedule.lastRunAt) {
      const lastRun = new Date(schedule.lastRunAt);
      if (!isNaN(lastRun.getTime())) {
        const isSameDay = lastRun.getFullYear() === now.getFullYear() &&
                          lastRun.getMonth() === now.getMonth() &&
                          lastRun.getDate() === now.getDate();
        if (isSameDay && lastRun.getTime() >= (targetToday.getTime() - 60000)) {
          // Already ran for today's slot
          return false;
        }
      }
    }
    return true;
  }

  return false;
}

export function computeNextRun(schedule: ProfileScheduleConfig, referenceDate: Date = new Date()): string | null {
  if (!schedule.enabled) return null;

  if (schedule.mode === "interval") {
    const hours = Math.max(1, schedule.intervalHours || 4);
    if (!schedule.lastRunAt) {
      // First automated interval runs 1 interval from now
      return new Date(referenceDate.getTime() + hours * 3600 * 1000).toISOString();
    }
    const lastRun = new Date(schedule.lastRunAt).getTime();
    if (isNaN(lastRun)) return new Date(referenceDate.getTime() + hours * 3600 * 1000).toISOString();
    const nextTime = lastRun + hours * 3600 * 1000;
    if (nextTime <= referenceDate.getTime()) {
      return referenceDate.toISOString();
    }
    return new Date(nextTime).toISOString();
  }

  if (schedule.mode === "daily") {
    const timeParts = (schedule.dailyTime || "08:00").split(":");
    const h = parseInt(timeParts[0] || "8", 10);
    const m = parseInt(timeParts[1] || "0", 10);
    const targetToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), h, m, 0, 0);

    if (referenceDate.getTime() >= targetToday.getTime()) {
      // Target time today has passed; next scheduled execution is tomorrow at target time
      const targetTomorrow = new Date(targetToday.getTime() + 24 * 3600 * 1000);
      return targetTomorrow.toISOString();
    } else {
      // Target time for today has not arrived yet
      return targetToday.toISOString();
    }
  }

  return null;
}

export function computeNextRunAfterRun(schedule: ProfileScheduleConfig, completedAt: Date = new Date()): string | null {
  if (!schedule.enabled) return null;

  if (schedule.mode === "interval") {
    const hours = Math.max(1, schedule.intervalHours || 4);
    return new Date(completedAt.getTime() + hours * 3600 * 1000).toISOString();
  }

  if (schedule.mode === "daily") {
    const timeParts = (schedule.dailyTime || "08:00").split(":");
    const h = parseInt(timeParts[0] || "8", 10);
    const m = parseInt(timeParts[1] || "0", 10);
    // Next execution is tomorrow at this time
    const targetTomorrow = new Date(completedAt.getFullYear(), completedAt.getMonth(), completedAt.getDate() + 1, h, m, 0, 0);
    return targetTomorrow.toISOString();
  }

  return null;
}

export function formatCountdown(nextRunIso: string | null | undefined, now: Date = new Date()): string {
  if (!nextRunIso) return "Schedule paused";
  const next = new Date(nextRunIso).getTime();
  if (isNaN(next)) return "Schedule paused";
  const diffMs = next - now.getTime();
  if (diffMs <= 0) return "Due now (executing shortly)";

  const diffMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `in ${days}d ${remHours}h`;
  }
  if (hours > 0) {
    return mins > 0 ? `in ${hours}h ${mins}m` : `in ${hours}h`;
  }
  return `in ${Math.max(1, mins)}m`;
}

export class SchedulerService {
  private profilesManager: ProfilesManager;
  private runScrape: ScrapeRunner;
  private timer: ReturnType<typeof setInterval> | null = null;
  private runningProfiles: Set<string> = new Set();
  private tickIntervalMs: number;

  constructor(profilesManager: ProfilesManager, runScrape: ScrapeRunner, tickIntervalMs: number = 30000) {
    this.profilesManager = profilesManager;
    this.runScrape = runScrape;
    this.tickIntervalMs = tickIntervalMs;
  }

  public start(): void {
    if (this.timer) return;
    console.log(`[SchedulerService] Started background scheduler worker (tick: ${this.tickIntervalMs / 1000}s)`);
    // Run an initial tick check
    this.tick();
    this.timer = setInterval(() => this.tick(), this.tickIntervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log("[SchedulerService] Stopped background scheduler worker");
    }
  }

  public isRunning(): boolean {
    return this.timer !== null;
  }

  public async tick(): Promise<void> {
    try {
      const allProfiles = this.profilesManager.getAllProfiles();
      const now = new Date();

      for (const profile of allProfiles) {
        if (!profile.schedule || !profile.schedule.enabled) continue;
        if (this.runningProfiles.has(profile.id)) continue;

        // If another profile is currently scraping in the background, wait for next tick
        // to prevent CPU spikes and concurrent network contention
        if (this.runningProfiles.size > 0) {
          break;
        }

        if (isScheduleDue(profile.schedule, now)) {
          console.log(`[SchedulerService] Profile '${profile.name}' (${profile.id}) is due for scheduled scraping. Triggering now...`);
          // Execute asynchronously so ticks are non-blocking
          this.executeForProfile(profile.id).catch(err => {
            console.error(`[SchedulerService] Background scrape error for profile '${profile.id}':`, err);
          });
          // Process one profile per tick cycle
          break;
        }
      }
    } catch (err) {
      console.error("[SchedulerService] Error during tick:", err);
    }
  }

  public async executeForProfile(profileId: string): Promise<ScrapeExecutionResult> {
    if (this.runningProfiles.has(profileId)) {
      return { foundCount: 0, addedCount: 0, error: "A search is already in progress for this profile" };
    }

    const profile = this.profilesManager.getProfile(profileId);
    if (!profile) {
      return { foundCount: 0, addedCount: 0, error: `Profile '${profileId}' not found` };
    }

    this.runningProfiles.add(profileId);
    const startedAt = new Date();

    try {
      const outcome = await this.runScrape(profile);
      const completedAt = new Date();

      const existingSchedule = profile.schedule || {
        enabled: true,
        mode: "interval",
        intervalHours: 4
      };

      const nextRunAt = computeNextRunAfterRun(existingSchedule, completedAt) || undefined;

      const updatedSchedule: ProfileScheduleConfig = {
        ...existingSchedule,
        lastRunAt: completedAt.toISOString(),
        nextRunAt,
        lastRunResult: {
          timestamp: completedAt.toISOString(),
          foundCount: outcome.foundCount,
          addedCount: outcome.addedCount,
          status: outcome.error ? "error" : "success",
          message: outcome.error || `Successfully found ${outcome.foundCount} jobs (${outcome.addedCount} newly added)`
        }
      };

      this.profilesManager.updateProfileSchedule(profileId, updatedSchedule);
      console.log(`[SchedulerService] Finished scheduled scrape for '${profile.name}'. Found ${outcome.foundCount}, added ${outcome.addedCount}. Next run: ${nextRunAt || "None"}`);
      return outcome;
    } catch (err: any) {
      const completedAt = new Date();
      console.error(`[SchedulerService] Failed scheduled scrape for '${profile.name}':`, err);

      const existingSchedule = profile.schedule || {
        enabled: true,
        mode: "interval",
        intervalHours: 4
      };

      const nextRunAt = computeNextRunAfterRun(existingSchedule, completedAt) || undefined;

      const updatedSchedule: ProfileScheduleConfig = {
        ...existingSchedule,
        lastRunAt: completedAt.toISOString(),
        nextRunAt,
        lastRunResult: {
          timestamp: completedAt.toISOString(),
          foundCount: 0,
          addedCount: 0,
          status: "error",
          message: err.message || "Scraper execution failed"
        }
      };

      this.profilesManager.updateProfileSchedule(profileId, updatedSchedule);
      return { foundCount: 0, addedCount: 0, error: err.message };
    } finally {
      this.runningProfiles.delete(profileId);
    }
  }

  public getStatus(profileId?: string): {
    serviceRunning: boolean;
    activeProfileSchedule?: ProfileScheduleConfig & {
      countdown: string;
      isDue: boolean;
      isRunningNow: boolean;
    };
    allSchedules: Array<{
      profileId: string;
      profileName: string;
      headline: string;
      schedule?: ProfileScheduleConfig;
      countdown?: string;
      isDue: boolean;
      isRunningNow: boolean;
    }>;
  } {
    const allProfiles = this.profilesManager.getAllProfiles();
    const now = new Date();
    const targetProfileId = profileId || this.profilesManager.getActiveProfile().id;

    const allSchedules = allProfiles.map(p => {
      const sched = p.schedule;
      const isRunningNow = this.runningProfiles.has(p.id);
      const isDue = sched ? isScheduleDue(sched, now) : false;
      const countdown = sched?.enabled && sched.nextRunAt ? formatCountdown(sched.nextRunAt, now) : (sched?.enabled ? "Due now" : "Disabled");

      return {
        profileId: p.id,
        profileName: p.name,
        headline: p.headline,
        schedule: sched,
        countdown,
        isDue,
        isRunningNow
      };
    });

    const activeItem = allSchedules.find(s => s.profileId === targetProfileId);

    return {
      serviceRunning: this.isRunning(),
      activeProfileSchedule: activeItem?.schedule ? {
        ...activeItem.schedule,
        countdown: activeItem.countdown || "",
        isDue: activeItem.isDue,
        isRunningNow: activeItem.isRunningNow
      } : undefined,
      allSchedules
    };
  }
}
