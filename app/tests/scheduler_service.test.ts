import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ProfilesManager, ProfileScheduleConfig } from "../profiles_manager";
import {
  SchedulerService,
  computeNextRun,
  computeNextRunAfterRun,
  isScheduleDue,
  formatCountdown
} from "../scheduler_service";

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));

describe("Scheduler logic: computeNextRun and isScheduleDue", () => {
  test("Interval mode: calculates due and next run times accurately", () => {
    const now = new Date("2026-10-28T12:00:00.000Z");

    // Disabled schedule
    const disabled: ProfileScheduleConfig = {
      enabled: false,
      mode: "interval",
      intervalHours: 4,
    };
    expect(isScheduleDue(disabled, now)).toBe(false);
    expect(computeNextRun(disabled, now)).toBe(null);

    // Enabled, never run before: initial run scheduled in the future (+4 hours), not due immediately
    const neverRun: ProfileScheduleConfig = {
      enabled: true,
      mode: "interval",
      intervalHours: 4,
    };
    expect(isScheduleDue(neverRun, now)).toBe(false);
    expect(computeNextRun(neverRun, now)).toBe(new Date("2026-10-28T16:00:00.000Z").toISOString());

    // Due when nextRunAt is explicitly set to now or in the past
    const dueByNextRun: ProfileScheduleConfig = {
      enabled: true,
      mode: "interval",
      intervalHours: 4,
      nextRunAt: now.toISOString(),
    };
    expect(isScheduleDue(dueByNextRun, now)).toBe(true);

    // Ran 1 hour ago (not due, next run is in 3 hours)
    const ran1HourAgo: ProfileScheduleConfig = {
      enabled: true,
      mode: "interval",
      intervalHours: 4,
      lastRunAt: new Date("2026-10-28T11:00:00.000Z").toISOString(),
    };
    expect(isScheduleDue(ran1HourAgo, now)).toBe(false);
    expect(computeNextRun(ran1HourAgo, now)).toBe(new Date("2026-10-28T15:00:00.000Z").toISOString());

    // Ran 5 hours ago (overdue)
    const ran5HoursAgo: ProfileScheduleConfig = {
      enabled: true,
      mode: "interval",
      intervalHours: 4,
      lastRunAt: new Date("2026-10-28T07:00:00.000Z").toISOString(),
    };
    expect(isScheduleDue(ran5HoursAgo, now)).toBe(true);
    expect(computeNextRun(ran5HoursAgo, now)).toBe(now.toISOString());
  });

  test("Daily mode: calculates due status and next run for daily target time", () => {
    // Current time: 10:00 AM local
    const now = new Date(2026, 9, 28, 10, 0, 0, 0);

    // Target time: 14:00 (hasn't arrived yet today)
    const schedLaterToday: ProfileScheduleConfig = {
      enabled: true,
      mode: "daily",
      dailyTime: "14:00",
    };
    expect(isScheduleDue(schedLaterToday, now)).toBe(false);
    const nextRun = computeNextRun(schedLaterToday, now);
    expect(nextRun).toBe(new Date(2026, 9, 28, 14, 0, 0, 0).toISOString());

    // Target time: 08:00 (arrived today at 10:00, so next run is scheduled tomorrow at 08:00)
    const schedPassedNotRun: ProfileScheduleConfig = {
      enabled: true,
      mode: "daily",
      dailyTime: "08:00",
    };
    const nextDailyRun = computeNextRun(schedPassedNotRun, now);
    expect(nextDailyRun).toBe(new Date(2026, 9, 29, 8, 0, 0, 0).toISOString());
    expect(isScheduleDue({ ...schedPassedNotRun, nextRunAt: nextDailyRun! }, now)).toBe(false);

    // Target time arrived and nextRunAt reached
    const schedDueNow: ProfileScheduleConfig = {
      enabled: true,
      mode: "daily",
      dailyTime: "08:00",
      nextRunAt: now.toISOString(),
    };
    expect(isScheduleDue(schedDueNow, now)).toBe(true);

    // Target time: 08:00 (already ran today at 08:02)
    const schedAlreadyRan: ProfileScheduleConfig = {
      enabled: true,
      mode: "daily",
      dailyTime: "08:00",
      lastRunAt: new Date(2026, 9, 28, 8, 2, 0, 0).toISOString(),
    };
    expect(isScheduleDue(schedAlreadyRan, now)).toBe(false);
    // Next run must be tomorrow at 08:00
    const tomorrowNext = computeNextRun(schedAlreadyRan, now);
    expect(tomorrowNext).toBe(new Date(2026, 9, 29, 8, 0, 0, 0).toISOString());
  });

  test("formatCountdown displays human-readable remaining time", () => {
    const now = new Date("2026-10-28T12:00:00.000Z");

    expect(formatCountdown(null, now)).toBe("Schedule paused");
    expect(formatCountdown(new Date("2026-10-28T11:59:00.000Z").toISOString(), now)).toBe("Due now (executing shortly)");
    expect(formatCountdown(new Date("2026-10-28T12:45:00.000Z").toISOString(), now)).toBe("in 45m");
    expect(formatCountdown(new Date("2026-10-28T15:30:00.000Z").toISOString(), now)).toBe("in 3h 30m");
    expect(formatCountdown(new Date("2026-10-30T16:00:00.000Z").toISOString(), now)).toBe("in 2d 4h");
  });
});

describe("SchedulerService execution & profile isolation", () => {
  test("Executes scheduled scrape for profile and updates schedule metadata", async () => {
    const root = mkdtempSync(join(tmpdir(), "scheduler-test-"));
    roots.push(root);

    const profilesManager = new ProfilesManager(root);
    const active = profilesManager.getActiveProfile();

    // Configure schedule
    profilesManager.updateProfileSchedule(active.id, {
      enabled: true,
      mode: "interval",
      intervalHours: 6
    });

    let scrapeCalls = 0;
    let scrapedProfileId = "";

    const scheduler = new SchedulerService(profilesManager, async (profile) => {
      scrapeCalls++;
      scrapedProfileId = profile.id;
      return {
        foundCount: 12,
        addedCount: 4,
        sourceBreakdown: [{ source: "LinkedIn", found: 12, added: 4, status: "ok" }]
      };
    }, 60000);

    const result = await scheduler.executeForProfile(active.id);
    expect(scrapeCalls).toBe(1);
    expect(scrapedProfileId).toBe(active.id);
    expect(result.foundCount).toBe(12);
    expect(result.addedCount).toBe(4);

    // Verify profile on disk has updated lastRunAt and nextRunAt
    const updated = profilesManager.getProfile(active.id);
    expect(updated?.schedule?.enabled).toBe(true);
    expect(updated?.schedule?.lastRunAt).toBeDefined();
    expect(updated?.schedule?.nextRunAt).toBeDefined();
    expect(updated?.schedule?.lastRunResult?.foundCount).toBe(12);
    expect(updated?.schedule?.lastRunResult?.addedCount).toBe(4);
    expect(updated?.schedule?.lastRunResult?.status).toBe("success");

    // Status inspection
    const status = scheduler.getStatus(active.id);
    expect(status.activeProfileSchedule?.lastRunResult?.foundCount).toBe(12);
    expect(status.allSchedules.length).toBeGreaterThanOrEqual(1);
  });

  test("Allows different schedules per candidate track or syncing to all profiles", () => {
    const root = mkdtempSync(join(tmpdir(), "multi-sched-test-"));
    roots.push(root);

    const profilesManager = new ProfilesManager(root);
    const profile1 = profilesManager.getActiveProfile();

    // Create a 2nd profile (e.g. Manju DevOps track)
    const profile2 = profilesManager.saveProfile({
      id: "manju-devops",
      name: "Manju S",
      headline: "DevOps Engineer",
      email: "manju@example.com",
      phone: "+447000000000",
      location: "Reading, United Kingdom",
      postcode: "RG1",
      linkedin: "",
      github: "",
      visaSponsorshipRequired: false,
      targetRoles: ["DevOps Engineer", "Platform Engineer"],
      targetLocations: ["Reading", "London"],
      preferredRadiusMiles: 30,
      minSalary: 80000,
      skills: { cloud: ["AWS"], containers: ["Kubernetes"] },
      experience: [],
      education: [],
      certifications: [],
    });

    // 1. Independent per-profile schedules:
    // Profile 1: runs every 2 hours
    profilesManager.updateProfileSchedule(profile1.id, {
      enabled: true,
      mode: "interval",
      intervalHours: 2,
    });

    // Profile 2: runs daily at 09:30
    profilesManager.updateProfileSchedule(profile2.id, {
      enabled: true,
      mode: "daily",
      dailyTime: "09:30",
    });

    const p1 = profilesManager.getProfile(profile1.id);
    const p2 = profilesManager.getProfile(profile2.id);
    expect(p1?.schedule?.intervalHours).toBe(2);
    expect(p1?.schedule?.mode).toBe("interval");
    expect(p2?.schedule?.mode).toBe("daily");
    expect(p2?.schedule?.dailyTime).toBe("09:30");

    // 2. Global Sync (Apply to all profiles):
    profilesManager.applyScheduleToAll({
      enabled: true,
      mode: "interval",
      intervalHours: 12,
    });

    const syncedP1 = profilesManager.getProfile(profile1.id);
    const syncedP2 = profilesManager.getProfile(profile2.id);
    expect(syncedP1?.schedule?.intervalHours).toBe(12);
    expect(syncedP2?.schedule?.intervalHours).toBe(12);
  });
});
