// AI Job Search Studio — Frontend App Logic
// Multi-Profile Management, In-App AI Provider, & Scenario Prompting

document.documentElement.dataset.platform = /win/i.test(navigator.platform) ? "windows" : /mac/i.test(navigator.platform) ? "mac" : "other";

let allJobs = [];
let selectedJob = null;
let currentFilter = "all";
let currentTab = "tab-cv";
let activeTailoredData = null;
let currentSortMode = "days";
let scenarioFeedFilters = {};
let searchConfig = null;

// Multi-Profile State
let allProfiles = [];
let activeProfile = null;
let selectedResumeFile = null;
let pendingModalProfileData = null;

// AI Config State
let aiConfig = null;

// DOM Elements - Main UI
const jobListEl = document.getElementById("jobList");
const searchInput = document.getElementById("searchInput");
const feedTitle = document.getElementById("feedTitle");
const feedCount = document.getElementById("feedCount");
const btnScrape = document.getElementById("btnScrape");
const scrapeSpinner = document.getElementById("scrapeSpinner");
const scrapeLabel = document.getElementById("scrapeLabel");
const btnRefresh = document.getElementById("btnRefresh");
const btnSearchSettings = document.getElementById("btnSearchSettings");

// Profile Switcher Elements
const topProfileName = document.getElementById("topProfileName");
const btnProfileDropdown = document.getElementById("btnProfileDropdown");
const profileDropdownMenu = document.getElementById("profileDropdownMenu");
const dropdownProfileList = document.getElementById("dropdownProfileList");
const btnOpenNewProfileModal = document.getElementById("btnOpenNewProfileModal");
const btnOpenImportResumeModal = document.getElementById("btnOpenImportResumeModal");
const btnOpenEditProfileModal = document.getElementById("btnOpenEditProfileModal");
const btnDeleteCurrentProfile = document.getElementById("btnDeleteCurrentProfile");

// Sidebar Profile Card Elements
const sidebarProfileName = document.getElementById("sidebarProfileName");
const sidebarProfileRole = document.getElementById("sidebarProfileRole");
const sidebarProfileLocation = document.getElementById("sidebarProfileLocation");
const sidebarProfileVisa = document.getElementById("sidebarProfileVisa");
const sidebarResumeSource = document.getElementById("sidebarResumeSource");
const sidebarEditProfileBtn = document.getElementById("sidebarEditProfileBtn");
const sidebarStatBase = document.getElementById("sidebarStatBase");
const sidebarStatRadius = document.getElementById("sidebarStatRadius");
const sidebarStatSalary = document.getElementById("sidebarStatSalary");
const navLabelNear = document.getElementById("navLabelNear");

// AI Status Elements
const btnAiSettings = document.getElementById("btnAiSettings");
const aiStatusDot = document.getElementById("aiStatusDot");
const aiStatusText = document.getElementById("aiStatusText");

// Scenario Prompt Elements
const scenarioInput = document.getElementById("scenarioInput");
const btnScenarioRun = document.getElementById("btnScenarioRun");
const scenarioSpinner = document.getElementById("scenarioSpinner");
const scenarioBtnText = document.getElementById("scenarioBtnText");
const scenarioStatus = document.getElementById("scenarioStatus");

// Studio Elements
const studioJobTitle = document.getElementById("studioJobTitle");
const studioCompanyName = document.getElementById("studioCompanyName");
const studioLocation = document.getElementById("studioLocation");
const studioLinkBtn = document.getElementById("studioLinkBtn");
const studioSponsorBanner = document.getElementById("studioSponsorBanner");
const studioSponsorText = document.getElementById("studioSponsorText");
const studioActionsBar = document.getElementById("studioActionsBar");
const studioTabs = document.getElementById("studioTabs");
const studioContent = document.getElementById("studioContent");
const btnTailor = document.getElementById("btnTailor");
const btnMarkApplied = document.getElementById("btnMarkApplied");
const btnCopyRecruiterMsg = document.getElementById("btnCopyRecruiterMsg");

// Badges
const countAll = document.getElementById("countAll");
const countRemote = document.getElementById("countRemote");
const countNear = document.getElementById("countNear");
const countScotland = document.getElementById("countScotland");
const countUkHybridSponsored = document.getElementById("countUkHybridSponsored");
const countDrafted = document.getElementById("countDrafted");
const countApplied = document.getElementById("countApplied");
const countSponsors = document.getElementById("countSponsors");
const countExplicitSponsors = document.getElementById("countExplicitSponsors");
const sponsorStatRatio = document.getElementById("sponsorStatRatio");

// Modals
const profileModal = document.getElementById("profileModal");
const profileModalTitle = document.getElementById("profileModalTitle");
const btnCloseProfileModal = document.getElementById("btnCloseProfileModal");
const btnCancelProfileModal = document.getElementById("btnCancelProfileModal");
const profileForm = document.getElementById("profileForm");

const importResumeModal = document.getElementById("importResumeModal");
const btnCloseImportModal = document.getElementById("btnCloseImportModal");
const btnCancelImportModal = document.getElementById("btnCancelImportModal");
const btnParseResumeRun = document.getElementById("btnParseResumeRun");
const rawResumeInput = document.getElementById("rawResumeInput");
const importSpinner = document.getElementById("importSpinner");

const aiConfigModal = document.getElementById("aiConfigModal");
const btnCloseAiModal = document.getElementById("btnCloseAiModal");
const btnTestAiConnection = document.getElementById("btnTestAiConnection");
const btnSaveAiConfig = document.getElementById("btnSaveAiConfig");
const aiHealthIcon = document.getElementById("aiHealthIcon");
const aiHealthMsg = document.getElementById("aiHealthMsg");
const aiOllamaHost = document.getElementById("aiOllamaHost");
const aiOllamaModelSelect = document.getElementById("aiOllamaModelSelect");
const aiAnthropicKey = document.getElementById("aiAnthropicKey");
const aiOpenAiKey = document.getElementById("aiOpenAiKey");
const ollamaSettings = document.getElementById("ollamaSettings");
const anthropicSettings = document.getElementById("anthropicSettings");
const openaiSettings = document.getElementById("openaiSettings");

const searchConfigModal = document.getElementById("searchConfigModal");
const btnCloseSearchConfig = document.getElementById("btnCloseSearchConfig");
const btnSaveSearchConfig = document.getElementById("btnSaveSearchConfig");
const btnRefreshSponsors = document.getElementById("btnRefreshSponsors");
const sponsorRegistryStatus = document.getElementById("sponsorRegistryStatus");
const runtimeIssues = document.getElementById("runtimeIssues");
const sourceRunStatus = document.getElementById("sourceRunStatus");

// Scheduler Modal Elements
const btnSchedule = document.getElementById("btnSchedule");
const btnDropdownOpenScheduleModal = document.getElementById("btnDropdownOpenScheduleModal");
const scheduleModal = document.getElementById("scheduleModal");
const btnCloseScheduleModal = document.getElementById("btnCloseScheduleModal");
const btnCancelSchedule = document.getElementById("btnCancelSchedule");
const btnSaveSchedule = document.getElementById("btnSaveSchedule");
const btnTestRunSchedule = document.getElementById("btnTestRunSchedule");
const testRunSpinner = document.getElementById("testRunSpinner");
const testRunLabel = document.getElementById("testRunLabel");
const schedEnabledToggle = document.getElementById("schedEnabledToggle");
const schedToggleDesc = document.getElementById("schedToggleDesc");
const schedIntervalSelect = document.getElementById("schedIntervalSelect");
const schedDailyTimeInput = document.getElementById("schedDailyTimeInput");
const schedApplyToAll = document.getElementById("schedApplyToAll");
const scheduleCandidateSubtitle = document.getElementById("scheduleCandidateSubtitle");
const schedStatusBadge = document.getElementById("schedStatusBadge");
const schedCountdownText = document.getElementById("schedCountdownText");
const schedLastRunText = document.getElementById("schedLastRunText");
const schedResultRow = document.getElementById("schedResultRow");
const schedLastResultText = document.getElementById("schedLastResultText");
const schedIntervalSection = document.getElementById("schedIntervalSection");
const schedDailySection = document.getElementById("schedDailySection");
const scheduleOptionsContainer = document.getElementById("scheduleOptionsContainer");

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  await fetchProfiles();
  await fetchAiConfig();
  await fetchSearchConfig();
  await fetchDiagnostics();
  await fetchJobs();
  setupEventListeners();
});

function setupEventListeners() {
  // Navigation filters
  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      currentFilter = item.dataset.filter;
      renderJobs();
    });
  });

  // Search input
  searchInput.addEventListener("input", () => {
    renderJobs();
  });

  // Sort selector
  const feedSortSelect = document.getElementById("feedSortSelect");
  feedSortSelect?.addEventListener("change", (e) => {
    currentSortMode = e.target.value;
    renderJobs();
  });

  // Refresh
  btnRefresh.addEventListener("click", () => {
    fetchJobs();
    showToast("Feed refreshed");
  });

  // Scrape button
  btnScrape.addEventListener("click", triggerScrape);
  btnSearchSettings?.addEventListener("click", async () => {
    await fetchSearchConfig();
    searchConfigModal.style.display = "flex";
  });
  btnCloseSearchConfig?.addEventListener("click", () => searchConfigModal.style.display = "none");
  btnSaveSearchConfig?.addEventListener("click", saveSearchConfig);
  btnRefreshSponsors?.addEventListener("click", refreshSponsorRegister);

  // Schedule button and modal triggers
  btnSchedule?.addEventListener("click", () => openScheduleModal());
  btnDropdownOpenScheduleModal?.addEventListener("click", () => {
    profileDropdownMenu.style.display = "none";
    openScheduleModal();
  });
  btnCloseScheduleModal?.addEventListener("click", closeScheduleModal);
  btnCancelSchedule?.addEventListener("click", closeScheduleModal);
  scheduleModal?.addEventListener("click", (e) => {
    if (e.target === scheduleModal) closeScheduleModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && scheduleModal?.style.display === "flex") {
      closeScheduleModal();
    }
  });
  btnSaveSchedule?.addEventListener("click", saveSchedule);
  btnTestRunSchedule?.addEventListener("click", runScheduleTestNow);

  // Frequency Mode radio switching
  document.querySelectorAll('input[name="schedMode"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      const mode = e.target.value;
      if (mode === "daily") {
        schedIntervalSection.style.display = "none";
        schedDailySection.style.display = "block";
      } else {
        schedIntervalSection.style.display = "block";
        schedDailySection.style.display = "none";
      }
    });
  });

  // Enable/disable toggle visual state
  schedEnabledToggle?.addEventListener("change", () => {
    const isEnabled = schedEnabledToggle.checked;
    scheduleOptionsContainer.style.opacity = isEnabled ? "1" : "0.5";
    scheduleOptionsContainer.style.pointerEvents = isEnabled ? "auto" : "none";
    schedStatusBadge.textContent = isEnabled ? "Active" : "Paused";
    schedStatusBadge.className = isEnabled ? "schedule-status-pill" : "schedule-status-pill paused";
    schedCountdownText.textContent = isEnabled ? "Next run: calculating on save..." : "Schedule paused";
    schedToggleDesc.textContent = isEnabled
      ? "Timer active — searches automatically according to selected frequency."
      : "Timer paused — no background searches will run until enabled.";
  });

  // Studio tabs
  document.querySelectorAll(".tab-btn").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentTab = tab.dataset.tab;
      renderStudioTabContent();
    });
  });

  // Tailor action
  btnTailor.addEventListener("click", tailorCurrentJob);

  // Mark applied
  btnMarkApplied.addEventListener("click", markCurrentJobApplied);

  // Outreach message
  btnCopyRecruiterMsg.addEventListener("click", copyOutreachMessage);

  // Profile dropdown toggling
  btnProfileDropdown.addEventListener("click", (e) => {
    e.stopPropagation();
    profileDropdownMenu.style.display = profileDropdownMenu.style.display === "none" ? "block" : "none";
  });

  document.addEventListener("click", (e) => {
    if (!profileDropdownMenu.contains(e.target) && e.target !== btnProfileDropdown) {
      profileDropdownMenu.style.display = "none";
    }
  });

  // Profile modal triggers
  btnOpenNewProfileModal.addEventListener("click", () => {
    profileDropdownMenu.style.display = "none";
    openProfileModal(null);
  });

  btnOpenEditProfileModal.addEventListener("click", () => {
    profileDropdownMenu.style.display = "none";
    openProfileModal(activeProfile);
  });

  sidebarEditProfileBtn.addEventListener("click", () => {
    openProfileModal(activeProfile);
  });

  btnDeleteCurrentProfile.addEventListener("click", deleteCurrentProfile);

  btnCloseProfileModal.addEventListener("click", () => profileModal.style.display = "none");
  btnCancelProfileModal.addEventListener("click", () => profileModal.style.display = "none");
  profileForm.addEventListener("submit", handleSaveProfileForm);

  // Import Resume modal triggers
  btnOpenImportResumeModal.addEventListener("click", () => {
    profileDropdownMenu.style.display = "none";
    rawResumeInput.value = "";
    selectedResumeFile = null;
    const defaultState = document.getElementById("dropzoneDefaultState");
    const selectedState = document.getElementById("dropzoneSelectedState");
    if (defaultState) defaultState.style.display = "block";
    if (selectedState) selectedState.style.display = "none";

    const newRadio = document.querySelector('input[name="importProfileMode"][value="new"]');
    if (newRadio) newRadio.checked = true;
    const updateLabel = document.getElementById("importUpdateProfileLabel");
    if (updateLabel) updateLabel.textContent = `✏️ Update Active Profile (${activeProfile?.name || 'Current'})`;

    importResumeModal.style.display = "flex";
  });
  document.getElementById("btnSidebarUploadResume")?.addEventListener("click", () => {
    rawResumeInput.value = "";
    selectedResumeFile = null;
    const defaultState = document.getElementById("dropzoneDefaultState");
    const selectedState = document.getElementById("dropzoneSelectedState");
    if (defaultState) defaultState.style.display = "block";
    if (selectedState) selectedState.style.display = "none";

    const updateRadio = document.querySelector('input[name="importProfileMode"][value="update"]');
    if (updateRadio) updateRadio.checked = true;
    const updateLabel = document.getElementById("importUpdateProfileLabel");
    if (updateLabel) updateLabel.textContent = `✏️ Update Active Profile (${activeProfile?.name || 'Current'})`;

    importResumeModal.style.display = "flex";
  });
  // In-Modal Profile Resume Dropzone & AI Auto-Fill Listeners
  const profileDropzone = document.getElementById("profileModalDropzone");
  const profileFileInput = document.getElementById("profileModalFileInput");
  const btnModalAutoFill = document.getElementById("btnProfileModalAutoFill");

  if (profileDropzone && profileFileInput) {
    profileDropzone.addEventListener("click", (e) => {
      if (e.target === profileFileInput || e.target === btnModalAutoFill) return;
      profileFileInput.click();
    });
    profileFileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleProfileModalAutofill(file);
    });
    profileDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      profileDropzone.classList.add("dragover");
    });
    profileDropzone.addEventListener("dragleave", () => profileDropzone.classList.remove("dragover"));
    profileDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      profileDropzone.classList.remove("dragover");
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleProfileModalAutofill(file);
    });
  }

  btnModalAutoFill?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (profileFileInput?.files && profileFileInput.files[0]) {
      handleProfileModalAutofill(profileFileInput.files[0]);
    } else {
      profileFileInput?.click();
    }
  });

  btnCloseImportModal.addEventListener("click", () => importResumeModal.style.display = "none");
  btnCancelImportModal.addEventListener("click", () => importResumeModal.style.display = "none");
  btnParseResumeRun.addEventListener("click", handleImportResume);

  // Resume File Dropzone & Input
  const dropzone = document.getElementById("resumeDropzone");
  const fileInput = document.getElementById("resumeFileInput");
  const btnRemoveSelected = document.getElementById("btnRemoveSelectedFile");

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", (e) => {
      if (e.target === fileInput) return;
      if (e.target && e.target.id === "btnRemoveSelectedFile") return;
      fileInput.click();
    });
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleResumeFileRead(file);
    });
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleResumeFileRead(file);
    });
  }

  btnRemoveSelected?.addEventListener("click", (e) => {
    e.stopPropagation();
    selectedResumeFile = null;
    if (fileInput) {
      fileInput.value = "";
      fileInput.style.display = "";
    }
    const defaultState = document.getElementById("dropzoneDefaultState");
    const selectedState = document.getElementById("dropzoneSelectedState");
    if (defaultState) defaultState.style.display = "block";
    if (selectedState) selectedState.style.display = "none";
    if (rawResumeInput) {
      rawResumeInput.value = "";
      rawResumeInput.placeholder = "Paste full resume text or LaTeX code here...";
    }
    showToast("Attached file removed.");
  });

  // Location Preferences Modal
  const btnCustomizeLocations = document.getElementById("btnCustomizeLocations");
  const locationPrefsModal = document.getElementById("locationPrefsModal");
  const btnCloseLocationPrefsModal = document.getElementById("btnCloseLocationPrefsModal");
  const btnCancelLocationPrefsModal = document.getElementById("btnCancelLocationPrefsModal");
  const locationPrefsForm = document.getElementById("locationPrefsForm");
  const locFormRadiusSlider = document.getElementById("locFormRadiusSlider");
  const locRadiusDisplay = document.getElementById("locRadiusDisplay");
  const locFormHomeCity = document.getElementById("locFormHomeCity");
  const locFormPostcode = document.getElementById("locFormPostcode");
  const locFormTargetLocations = document.getElementById("locFormTargetLocations");
  const locFormVisaRequired = document.getElementById("locFormVisaRequired");

  if (btnCustomizeLocations) {
    btnCustomizeLocations.addEventListener("click", () => {
      if (!activeProfile) return;
      locFormHomeCity.value = activeProfile.location || "";
      locFormPostcode.value = activeProfile.postcode || "";
      locFormRadiusSlider.value = activeProfile.preferredRadiusMiles || 50;
      locRadiusDisplay.textContent = `${activeProfile.preferredRadiusMiles || 50} miles`;
      locFormTargetLocations.value = (activeProfile.targetLocations || []).join(", ");
      locFormVisaRequired.checked = !!activeProfile.visaSponsorshipRequired;
      locationPrefsModal.style.display = "flex";
    });
  }

  locFormRadiusSlider?.addEventListener("input", (e) => {
    locRadiusDisplay.textContent = `${e.target.value} miles`;
  });

  const closeLocPrefs = () => { if (locationPrefsModal) locationPrefsModal.style.display = "none"; };
  btnCloseLocationPrefsModal?.addEventListener("click", closeLocPrefs);
  btnCancelLocationPrefsModal?.addEventListener("click", closeLocPrefs);

  locationPrefsForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!activeProfile) return;

    const targets = locFormTargetLocations.value
      .split(",")
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const updated = {
      ...activeProfile,
      location: locFormHomeCity.value.trim(),
      postcode: locFormPostcode.value.trim(),
      preferredRadiusMiles: parseInt(locFormRadiusSlider.value) || 50,
      targetLocations: targets.length > 0 ? targets : ["Remote"],
      visaSponsorshipRequired: locFormVisaRequired.checked
    };

    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated)
      });
      const data = await res.json();
      if (data.success) {
        activeProfile = data.profile;
        updateProfileUI();
        closeLocPrefs();
        showToast("📍 Location priorities & commute radius updated!");
        await fetchJobs();
      } else {
        showToast("Failed to update location preferences");
      }
    } catch (err) {
      console.error(err);
      showToast("Error updating location preferences");
    }
  });

  // AI Configuration triggers
  btnAiSettings.addEventListener("click", openAiModal);
  btnCloseAiModal.addEventListener("click", () => aiConfigModal.style.display = "none");
  btnTestAiConnection.addEventListener("click", testAiConnection);
  btnSaveAiConfig.addEventListener("click", saveAiConfig);
  document.getElementById("btnAutoSelectBestModel")?.addEventListener("click", handleAutoSelectBestModel);

  document.querySelectorAll('input[name="aiProvider"]').forEach(radio => {
    radio.addEventListener("change", (e) => {
      const val = e.target.value;
      ollamaSettings.style.display = val === "ollama" ? "block" : "none";
      anthropicSettings.style.display = val === "anthropic" ? "block" : "none";
      openaiSettings.style.display = val === "openai" ? "block" : "none";
      if (val !== "builtin") {
        scanProviderModels(val);
      }
    });
  });

  // Scenario Bar
  btnScenarioRun.addEventListener("click", runScenarioPrompt);
  scenarioInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runScenarioPrompt();
    }
  });

  // Quick Scenario Chips
  document.querySelectorAll(".scenario-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      scenarioInput.value = chip.dataset.prompt;
      runScenarioPrompt();
    });
  });

  // Keyboard shortcut: cmd+k for search
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      searchInput.focus();
    }
  });
}

// --------------------------------------------------------------------------
// Multi-Profile Management
// --------------------------------------------------------------------------

async function fetchProfiles() {
  try {
    const res = await fetch("/api/profiles");
    if (!res.ok) return;
    const data = await res.json();
    allProfiles = data.profiles || [];
    const activeId = data.activeProfileId;
    activeProfile = allProfiles.find(p => p.id === activeId) || allProfiles[0];

    updateProfileUI();
    renderProfileDropdownList();
  } catch (err) {
    console.error("Failed to load candidate profiles:", err);
  }
}

function updateProfileUI() {
  if (!activeProfile) return;

  topProfileName.textContent = activeProfile.name;
  sidebarProfileName.textContent = activeProfile.name;
  sidebarProfileRole.textContent = activeProfile.headline;
  sidebarProfileLocation.textContent = `📍 ${activeProfile.location}`;
  sidebarProfileVisa.textContent = activeProfile.visaSponsorshipRequired ?
    "🛡️ Skilled Worker Sponsor Required" : "✅ Direct UK Work Authorisation";
  sidebarProfileVisa.style.background = activeProfile.visaSponsorshipRequired ? "var(--apple-purple-bg)" : "var(--apple-green-bg)";
  sidebarProfileVisa.style.color = activeProfile.visaSponsorshipRequired ? "var(--apple-purple)" : "var(--apple-green)";
  if (sidebarResumeSource) {
    const source = activeProfile.sourceResume;
    sidebarResumeSource.textContent = source?.fileName
      ? `Source stored locally: ${source.fileName}`
      : "No source résumé stored";
    sidebarResumeSource.title = source?.importedAt ? `Imported ${new Date(source.importedAt).toLocaleString()}` : "";
  }

  sidebarStatBase.textContent = `${activeProfile.location.split(",")[0]}${activeProfile.postcode ? ` (${activeProfile.postcode})` : ''}`;
  sidebarStatRadius.textContent = `${activeProfile.preferredRadiusMiles || 50} miles`;
  sidebarStatSalary.textContent = `£${(activeProfile.minSalary || 75000).toLocaleString()}`;

  renderLocationNavFilters();
}

function renderProfileDropdownList() {
  dropdownProfileList.innerHTML = "";
  allProfiles.forEach(p => {
    const item = document.createElement("div");
    item.className = `dropdown-profile-item ${p.id === activeProfile?.id ? "active" : ""}`;
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.justifyContent = "space-between";
    item.style.padding = "8px 12px";

    const left = document.createElement("div");
    left.style.flex = "1";
    left.style.minWidth = "0";
    left.style.cursor = "pointer";
    left.innerHTML = `
      <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.name)}</div>
      <div style="font-size: 11px; opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(p.headline || "Candidate Profile")}</div>
    `;
    left.addEventListener("click", () => switchActiveProfile(p.id));

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "8px";
    right.style.marginLeft = "8px";

    if (p.id === activeProfile?.id) {
      const check = document.createElement("span");
      check.textContent = "✓";
      check.style.color = "#22c55e";
      check.style.fontWeight = "bold";
      right.appendChild(check);
    }

    if (allProfiles.length > 1) {
      const btnDel = document.createElement("button");
      btnDel.title = `Delete profile: ${p.name}`;
      btnDel.innerHTML = "🗑️";
      btnDel.style.background = "transparent";
      btnDel.style.border = "none";
      btnDel.style.cursor = "pointer";
      btnDel.style.padding = "2px 4px";
      btnDel.style.fontSize = "12px";
      btnDel.style.opacity = "0.6";
      btnDel.style.borderRadius = "4px";
      btnDel.addEventListener("mouseenter", () => { btnDel.style.opacity = "1"; btnDel.style.background = "rgba(239, 68, 68, 0.2)"; });
      btnDel.addEventListener("mouseleave", () => { btnDel.style.opacity = "0.6"; btnDel.style.background = "transparent"; });
      btnDel.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteProfileById(p.id, p.name);
      });
      right.appendChild(btnDel);
    }

    item.appendChild(left);
    item.appendChild(right);
    dropdownProfileList.appendChild(item);
  });

  // Hide or show delete button (can't delete if only 1 profile)
  btnDeleteCurrentProfile.style.display = allProfiles.length > 1 ? "flex" : "none";
}

async function switchActiveProfile(profileId) {
  profileDropdownMenu.style.display = "none";
  try {
    const res = await fetch("/api/profiles/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: profileId })
    });
    const data = await res.json();
    if (data.success) {
      activeProfile = data.activeProfile;
      updateProfileUI();
      renderProfileDropdownList();
      showToast(`Switched active profile to ${activeProfile.name}`);
      await fetchJobs();
    }
  } catch (err) {
    console.error("Failed to switch profile:", err);
    showToast("Error switching profile");
  }
}

function extractAllSkillsFlat(skillsObj, keywords) {
  const set = new Set();
  if (Array.isArray(keywords)) {
    for (const k of keywords) {
      if (typeof k === "string" && k.trim()) set.add(k.trim());
    }
  }
  if (skillsObj && typeof skillsObj === "object") {
    for (const [key, val] of Object.entries(skillsObj)) {
      if (Array.isArray(val)) {
        for (const s of val) {
          if (typeof s === "string" && s.trim()) set.add(s.trim());
        }
      }
    }
  }
  return Array.from(set);
}

function groupManualSkills(rawSkills, baseSkills) {
  const skills = baseSkills ? JSON.parse(JSON.stringify(baseSkills)) : { cloud: [], devops: [], languages: [], tools: [] };
  const existingSet = new Set(extractAllSkillsFlat(skills).map(s => s.toLowerCase()));

  const cloudKw = ["aws", "azure", "gcp", "cloud", "google cloud", "bicep", "cloudformation"];
  const langKw = ["python", "c#", ".net", "dotnet", "java", "typescript", "javascript", "golang", "go", "php", "ruby", "rust", "c++", "sql", "html", "css", "react", "angular", "vue", "fastapi", "django", "flask", "spring"];
  const devopsKw = ["kubernetes", "k8s", "docker", "terraform", "ci/cd", "git", "ansible", "jenkins", "argocd", "linux", "dynamics", "power platform", "power apps", "power automate", "dataverse", "crm", "erp", "salesforce"];

  for (const s of rawSkills) {
    if (existingSet.has(s.toLowerCase())) continue;
    const lower = s.toLowerCase();
    if (cloudKw.some(k => lower.includes(k))) {
      if (!skills.cloud) skills.cloud = [];
      skills.cloud.push(s);
    } else if (langKw.some(k => lower.includes(k))) {
      if (!skills.languages) skills.languages = [];
      skills.languages.push(s);
    } else if (devopsKw.some(k => lower.includes(k))) {
      if (!skills.devops) skills.devops = [];
      skills.devops.push(s);
    } else {
      if (!skills.tools) skills.tools = [];
      skills.tools.push(s);
    }
    existingSet.add(s.toLowerCase());
  }
  return skills;
}

async function handleProfileModalAutofill(file) {
  if (!file) return;
  const statusEl = document.getElementById("profileModalAutofillStatus");
  const primaryText = document.getElementById("profileDropzonePrimaryText");
  const icon = document.getElementById("profileDropzoneIcon");
  const spinner = document.getElementById("profileAutoFillBtnSpinner");
  const btnText = document.getElementById("profileAutoFillBtnText");
  const btn = document.getElementById("btnProfileModalAutoFill");

  if (primaryText) primaryText.textContent = `📄 ${file.name} (${Math.round(file.size / 1024) || 1} KB)`;
  if (icon) icon.textContent = file.name.toLowerCase().endsWith(".pdf") ? "📑" : file.name.toLowerCase().endsWith(".tex") ? "📝" : "📄";
  if (statusEl) {
    statusEl.style.display = "flex";
    statusEl.innerHTML = `<span class="spinner" style="display:inline-block; width:12px; height:12px; margin-right:6px;"></span> Extracting candidate profile with AI...`;
  }
  if (spinner) spinner.style.display = "inline-block";
  if (btnText) btnText.textContent = "Auto-filling...";
  if (btn) btn.disabled = true;

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("previewOnly", "true");

    const res = await fetch("/api/profiles/parse-resume", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    if (data.success && data.profile) {
      const p = data.profile;
      pendingModalProfileData = p;

      if (p.name) document.getElementById("formName").value = p.name;
      if (p.headline) document.getElementById("formHeadline").value = p.headline;
      if (p.email) document.getElementById("formEmail").value = p.email;
      if (p.phone) document.getElementById("formPhone").value = p.phone;
      if (p.location) document.getElementById("formLocation").value = p.location;
      if (p.postcode) document.getElementById("formPostcode").value = p.postcode;
      if (p.linkedin) document.getElementById("formLinkedin").value = p.linkedin;
      if (p.github || p.portfolio) document.getElementById("formGithub").value = p.github || p.portfolio;
      if (p.preferredRadiusMiles) document.getElementById("formRadius").value = p.preferredRadiusMiles;
      if (p.minSalary) document.getElementById("formMinSalary").value = p.minSalary;
      if (typeof p.visaSponsorshipRequired === "boolean") document.getElementById("formVisaRequired").checked = p.visaSponsorshipRequired;

      const roles = (p.targetRoles && p.targetRoles.length) ? p.targetRoles : (p.headline ? [p.headline] : []);
      if (roles.length) document.getElementById("formTargetRoles").value = roles.join(", ");

      const locations = (p.targetLocations && p.targetLocations.length) ? p.targetLocations : (p.location ? ["Remote", p.location] : []);
      if (locations.length) document.getElementById("formTargetLocations").value = locations.join(", ");

      const allSkills = extractAllSkillsFlat(p.skills, p.keywords);
      if (allSkills.length) document.getElementById("formSkills").value = allSkills.join(", ");

      if (statusEl) {
        statusEl.innerHTML = `<span style="color: var(--apple-green); font-weight: 600;">✅ Auto-filled all fields with AI from ${escapeHtml(file.name)}!</span> <span style="color: var(--text-secondary); margin-left: 6px;">Review or customize any field below before saving.</span>`;
      }
      if (icon) icon.textContent = "✨";
      showToast(`✨ Auto-filled profile fields for ${p.name || "candidate"}!`);
    } else {
      if (statusEl) {
        statusEl.innerHTML = `<span style="color: var(--apple-red); font-weight: 500;">⚠️ ${escapeHtml(data.error || "Could not parse resume")}</span>`;
      }
      showToast(data.error || "Failed to parse resume");
    }
  } catch (err) {
    console.error("Auto-fill error:", err);
    if (statusEl) {
      statusEl.innerHTML = `<span style="color: var(--apple-red); font-weight: 500;">⚠️ Error parsing resume</span>`;
    }
    showToast("Error during AI auto-fill");
  } finally {
    if (spinner) spinner.style.display = "none";
    if (btnText) btnText.textContent = "✨ Auto-Fill with AI";
    if (btn) btn.disabled = false;
  }
}

function openProfileModal(profileToEdit) {
  pendingModalProfileData = null;
  const statusEl = document.getElementById("profileModalAutofillStatus");
  if (statusEl) {
    statusEl.style.display = "none";
    statusEl.innerHTML = "";
  }
  const primaryText = document.getElementById("profileDropzonePrimaryText");
  if (primaryText) primaryText.textContent = "Upload Resume to Auto-Fill All Fields with AI";
  const icon = document.getElementById("profileDropzoneIcon");
  if (icon) icon.textContent = "📁";
  const fileInput = document.getElementById("profileModalFileInput");
  if (fileInput) fileInput.value = "";

  if (profileToEdit) {
    profileModalTitle.textContent = `Edit Profile: ${profileToEdit.name}`;
    document.getElementById("formProfileId").value = profileToEdit.id;
    document.getElementById("formName").value = profileToEdit.name;
    document.getElementById("formHeadline").value = profileToEdit.headline;
    document.getElementById("formEmail").value = profileToEdit.email;
    document.getElementById("formPhone").value = profileToEdit.phone || "";
    document.getElementById("formLocation").value = profileToEdit.location;
    document.getElementById("formPostcode").value = profileToEdit.postcode || "";
    document.getElementById("formLinkedin").value = profileToEdit.linkedin || "";
    document.getElementById("formGithub").value = profileToEdit.github || "";
    document.getElementById("formRadius").value = profileToEdit.preferredRadiusMiles || 70;
    document.getElementById("formMinSalary").value = profileToEdit.minSalary || 75000;
    document.getElementById("formVisaRequired").checked = profileToEdit.visaSponsorshipRequired;
    document.getElementById("formTargetRoles").value = (profileToEdit.targetRoles || []).join(", ");
    document.getElementById("formTargetLocations").value = (profileToEdit.targetLocations || []).join(", ");

    const allSkills = extractAllSkillsFlat(profileToEdit.skills, profileToEdit.keywords);
    document.getElementById("formSkills").value = allSkills.join(", ");
  } else {
    profileModalTitle.textContent = "Create New Candidate Profile";
    profileForm.reset();
    document.getElementById("formProfileId").value = "";
    document.getElementById("formRadius").value = "70";
    document.getElementById("formMinSalary").value = "75000";
    document.getElementById("formVisaRequired").checked = true;
  }
  profileModal.style.display = "flex";
}

async function handleSaveProfileForm(e) {
  e.preventDefault();
  const id = document.getElementById("formProfileId").value;
  const name = document.getElementById("formName").value.trim();
  const headline = document.getElementById("formHeadline").value.trim();
  const email = document.getElementById("formEmail").value.trim();
  const phone = document.getElementById("formPhone").value.trim();
  const location = document.getElementById("formLocation").value.trim();
  const postcode = document.getElementById("formPostcode").value.trim();
  const linkedin = document.getElementById("formLinkedin").value.trim();
  const github = document.getElementById("formGithub").value.trim();
  const preferredRadiusMiles = parseInt(document.getElementById("formRadius").value) || 70;
  const minSalary = parseInt(document.getElementById("formMinSalary").value) || 75000;
  const visaSponsorshipRequired = document.getElementById("formVisaRequired").checked;
  const targetRoles = document.getElementById("formTargetRoles").value.split(",").map(s => s.trim()).filter(Boolean);
  const targetLocations = document.getElementById("formTargetLocations").value.split(",").map(s => s.trim()).filter(Boolean);
  const rawSkills = document.getElementById("formSkills").value.split(",").map(s => s.trim()).filter(Boolean);

  const existing = id ? allProfiles.find(p => p.id === id) : null;
  let resolvedId = id;
  if (!resolvedId) {
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "candidate";
    const roleWord = headline.toLowerCase().match(/dynamics|devops|qa|tester|frontend|backend|cloud|sre|platform|data|security|mobile|nurse|accountant|analyst/)?.[0];
    const candidateRoleSlug = roleWord ? `${baseSlug}-${roleWord}` : "";
    if (candidateRoleSlug && !allProfiles.some(p => p.id === candidateRoleSlug)) {
      resolvedId = candidateRoleSlug;
    } else if (!allProfiles.some(p => p.id === baseSlug)) {
      resolvedId = baseSlug;
    } else {
      let counter = 2;
      resolvedId = `${baseSlug}-${counter}`;
      while (allProfiles.some(p => p.id === resolvedId)) {
        resolvedId = `${baseSlug}-${++counter}`;
      }
    }
  }

  const baseSkills = pendingModalProfileData?.skills || existing?.skills;
  const finalSkills = groupManualSkills(rawSkills, baseSkills);

  const profilePayload = {
    id: resolvedId,
    name,
    headline,
    email,
    phone,
    location,
    postcode,
    linkedin,
    github,
    preferredRadiusMiles,
    minSalary,
    visaSponsorshipRequired,
    targetRoles: targetRoles.length > 0 ? targetRoles : [headline],
    targetLocations: targetLocations.length > 0 ? targetLocations : ["Remote", location],
    skills: finalSkills,
    experience: (pendingModalProfileData?.experience && pendingModalProfileData.experience.length > 0)
      ? pendingModalProfileData.experience
      : (existing?.experience || []),
    education: (pendingModalProfileData?.education && pendingModalProfileData.education.length > 0)
      ? pendingModalProfileData.education
      : (existing?.education || []),
    certifications: (pendingModalProfileData?.certifications && pendingModalProfileData.certifications.length > 0)
      ? pendingModalProfileData.certifications
      : (existing?.certifications || []),
    projects: (pendingModalProfileData?.projects && pendingModalProfileData.projects.length > 0)
      ? pendingModalProfileData.projects
      : (existing?.projects || []),
    latexBackbone: pendingModalProfileData?.latexBackbone || existing?.latexBackbone,
    sourceResume: pendingModalProfileData?.sourceResume || existing?.sourceResume,
    summary: pendingModalProfileData?.summary || existing?.summary || "",
  };

  try {
    const res = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profilePayload)
    });
    const data = await res.json();
    if (data.success) {
      pendingModalProfileData = null;
      profileModal.style.display = "none";
      showToast(`Saved profile for ${name}`);
      await fetchProfiles();
      await switchActiveProfile(data.profile.id);
    }
  } catch (err) {
    showToast("Error saving profile");
  }
}

async function deleteProfileById(profileId, profileName) {
  if (allProfiles.length <= 1) {
    showToast("Cannot delete the only profile");
    return;
  }
  const confirmed = confirm(`Are you sure you want to delete profile: ${profileName}? This action cannot be undone.`);
  if (!confirmed) return;

  try {
    const res = await fetch("/api/profiles", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: profileId })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Deleted profile: ${profileName}`);
      await fetchProfiles();
      renderProfileDropdownList();
      updateProfileUI();
      await fetchJobs();
    } else {
      showToast(data.error || "Failed to delete profile");
    }
  } catch (err) {
    console.error("Delete profile error:", err);
    showToast("Error deleting profile");
  }
}

async function deleteCurrentProfile() {
  if (!activeProfile) return;
  await deleteProfileById(activeProfile.id, activeProfile.name);
}

function handleResumeFileRead(file) {
  if (!file) return;
  selectedResumeFile = file;

  const defaultState = document.getElementById("dropzoneDefaultState");
  const selectedState = document.getElementById("dropzoneSelectedState");
  const fileInput = document.getElementById("resumeFileInput");
  const nameEl = document.getElementById("selectedFileName");
  const sizeEl = document.getElementById("selectedFileSize");
  const iconEl = document.getElementById("selectedFileIcon");

  if (fileInput) fileInput.style.display = "none";
  if (defaultState) defaultState.style.display = "none";
  if (selectedState) selectedState.style.display = "flex";
  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = `${Math.round(file.size / 1024) || 1} KB · Ready to parse with AI`;
  if (iconEl) iconEl.textContent = file.name.toLowerCase().endsWith(".pdf") ? "📑" : file.name.toLowerCase().endsWith(".tex") ? "📝" : "📄";

  if (file.name.toLowerCase().endsWith(".pdf")) {
    rawResumeInput.value = "";
    rawResumeInput.placeholder = `[PDF File Attached: "${file.name}" (${Math.round(file.size / 1024) || 1} KB)]\nClick "✨ Parse & Create Profile" to extract text with pypdf and build profile.`;
    showToast(`📑 Attached PDF "${file.name}". Click "Parse & Create Profile".`);
  } else {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result || "";
      if (typeof content === "string") {
        rawResumeInput.value = content;
        showToast(`📁 Loaded "${file.name}" (${Math.round(content.length / 1024) || 1} KB).`);
      }
    };
    reader.onerror = () => showToast("Error reading file.");
    reader.readAsText(file);
  }
}

async function handleImportResume() {
  const hasFile = !!selectedResumeFile;
  const text = rawResumeInput.value.trim();

  if (!hasFile && (!text || text.length < 50)) {
    showToast("Please select a resume file (.pdf, .tex, .txt) or paste resume text.");
    return;
  }

  btnParseResumeRun.disabled = true;
  importSpinner.style.display = "inline-block";

  try {
    const isUpdate = document.querySelector('input[name="importProfileMode"]:checked')?.value === "update";
    const targetProfileId = isUpdate ? activeProfile?.id : undefined;

    let res;
    if (selectedResumeFile) {
      const formData = new FormData();
      formData.append("file", selectedResumeFile);
      if (targetProfileId) {
        formData.append("targetProfileId", targetProfileId);
      }
      if (text && !selectedResumeFile.name.toLowerCase().endsWith(".pdf")) {
        formData.append("resumeText", text);
      }
      res = await fetch("/api/profiles/import-resume", {
        method: "POST",
        body: formData
      });
    } else {
      const payload = { resumeText: text };
      if (targetProfileId) payload.targetProfileId = targetProfileId;
      res = await fetch("/api/profiles/import-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();
    if (data.success && data.profile) {
      importResumeModal.style.display = "none";
      selectedResumeFile = null;
      const defaultState = document.getElementById("dropzoneDefaultState");
      const selectedState = document.getElementById("dropzoneSelectedState");
      if (defaultState) defaultState.style.display = "block";
      if (selectedState) selectedState.style.display = "none";
      rawResumeInput.value = "";

      showToast(`✨ Successfully imported profile for ${data.profile.name}!`);
      activeProfile = data.profile;
      await fetchProfiles();
      updateProfileUI();
      renderLocationNavFilters();
      await fetchJobs();
    } else {
      showToast(data.error || "Failed to parse resume");
    }
  } catch (err) {
    console.error(err);
    showToast("Error parsing resume");
  } finally {
    btnParseResumeRun.disabled = false;
    importSpinner.style.display = "none";
  }
}

// --------------------------------------------------------------------------
// Scenario AI Prompt Bar
// --------------------------------------------------------------------------

async function runScenarioPrompt() {
  const prompt = scenarioInput.value.trim();
  if (!prompt) return;

  btnScenarioRun.disabled = true;
  scenarioSpinner.style.display = "inline-block";
  scenarioBtnText.textContent = "AI Processing...";
  if (scenarioStatus) scenarioStatus.textContent = selectedJob ? `Working on ${selectedJob.title}…` : "Interpreting command…";

  try {
    const res = await fetch("/api/ai/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, jobId: selectedJob?.id || null, currentTab })
    });
    const data = await res.json();
    if (data.success) {
      scenarioInput.value = "";
      if (data.action === "scrape_and_tailor" && data.job) {
        await fetchProfiles();
        await fetchJobs();
        const targetJob = allJobs.find(j => j.id === data.job.id) || data.job;
        selectJob(targetJob);
        showToast(data.explanation);
        await tailorCurrentJob();
      } else if (data.action === "search_jobs") {
        scenarioFeedFilters = data.feedFilters || {};
        searchInput.value = scenarioFeedFilters.query || "";
        currentFilter = scenarioFeedFilters.sponsorshipMode === "explicit" ? "sponsorship_explicit"
          : scenarioFeedFilters.sponsorshipMode === "licensed" ? "sponsor_verified"
          : scenarioFeedFilters.location?.toLowerCase() === "remote" ? "remote" : "all";
        scenarioBtnText.textContent = "Searching...";
        const searchRes = await fetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(scenarioFeedFilters)
        });
        const searchData = await searchRes.json();
        if (!searchRes.ok || !searchData.success) throw new Error(searchData.error || "Live search failed");
        renderSourceStatus(searchData);
        await fetchJobs();
        renderJobs();
        showToast(`${data.explanation} ${searchData.addedCount || 0} new roles added.`);
        if (scenarioStatus) scenarioStatus.textContent = `Search complete · ${searchData.addedCount || 0} new roles`;
      } else if (data.action === "edit_application") {
        selectedJob.status = data.status || "drafted";
        selectedJob.cv_file = data.cvPath || selectedJob.cv_file;
        selectedJob.cover_file = data.coverPath || selectedJob.cover_file;
        selectedJob.analysis = data.analysis || selectedJob.analysis;
        selectedJob.fit_score = data.fit_score ?? selectedJob.fit_score;
        activeTailoredData = data;
        renderJobs();
        renderStudioTabContent();
        showToast(data.explanation);
        if (scenarioStatus) scenarioStatus.textContent = "Open application updated from stored evidence";
      } else {
        scenarioFeedFilters = data.feedFilters || {};
        if (scenarioFeedFilters.query) searchInput.value = scenarioFeedFilters.query;
        showToast(data.explanation);
        await fetchProfiles();
        await fetchJobs();
        if (selectedJob) renderStudioTabContent();
        if (scenarioStatus) scenarioStatus.textContent = "Command applied";
      }
    } else {
      showToast(data.error || "Failed to run scenario");
      if (scenarioStatus) scenarioStatus.textContent = data.error || "Command not applied";
    }
  } catch (err) {
    console.error(err);
    showToast(err.message || "Scenario action failed. Try a more specific request.");
    if (scenarioStatus) scenarioStatus.textContent = err.message || "Command failed";
  } finally {
    btnScenarioRun.disabled = false;
    scenarioSpinner.style.display = "none";
    scenarioBtnText.textContent = "Run";
  }
}

// --------------------------------------------------------------------------
// AI Engine Configuration & Health
// --------------------------------------------------------------------------

let providerModelsCache = {};

async function fetchAiConfig() {
  try {
    const res = await fetch("/api/ai/config");
    if (!res.ok) return;
    const data = await res.json();
    aiConfig = data.config;

    // Update titlebar pill
    const provider = aiConfig.provider;
    if (data.health?.status === "connected") {
      aiStatusDot.className = "ai-status-dot online";
      if (provider === "ollama") {
        aiStatusText.textContent = `Ollama: ${aiConfig.ollamaModel}`;
      } else if (provider === "anthropic") {
        aiStatusText.textContent = `Claude: ${aiConfig.anthropicModel || "Active"}`;
      } else if (provider === "openai") {
        aiStatusText.textContent = `OpenAI: ${aiConfig.openaiModel || "Active"}`;
      } else if (provider === "builtin") {
        aiStatusText.textContent = "Built-in · local";
      } else {
        aiStatusText.textContent = "AI provider ready";
      }
    } else {
      aiStatusDot.className = "ai-status-dot offline";
      aiStatusText.textContent = `AI: ${provider} (Offline)`;
    }

    // Populate model options for ollama if provided
    if (data.models && data.models.length > 0) {
      aiOllamaModelSelect.innerHTML = "";
      data.models.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m;
        opt.textContent = m;
        if (m === aiConfig.ollamaModel) opt.selected = true;
        aiOllamaModelSelect.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("AI config load error:", err);
  }
}

async function scanProviderModels(provider, explicitKey = "", force = false) {
  if (!provider || provider === "builtin") return;

  const selectElem = document.getElementById(
    provider === "anthropic" ? "aiAnthropicModelSelect" :
    provider === "openai" ? "aiOpenAiModelSelect" : "aiOllamaModelSelect"
  );
  const statusElem = document.getElementById(
    provider === "anthropic" ? "anthropicKeyStatusMsg" :
    provider === "openai" ? "openAiKeyStatusMsg" : "ollamaStatusMsg"
  );
  const hintElem = document.getElementById(
    provider === "anthropic" ? "anthropicModelHint" :
    provider === "openai" ? "openAiModelHint" : "ollamaModelHint"
  );
  const btnUseRec = document.getElementById(
    provider === "anthropic" ? "btnUseAnthropicRecommended" :
    provider === "openai" ? "btnUseOpenAiRecommended" : "btnUseOllamaRecommended"
  );
  const scanBtn = document.getElementById(
    provider === "anthropic" ? "btnScanAnthropicModels" :
    provider === "openai" ? "btnScanOpenAiModels" : "btnScanOllamaModels"
  );

  if (!selectElem) return;

  if (!force && providerModelsCache[provider]?.models?.length > 0 && selectElem.options.length > 1) {
    updateModelHintAndBadge(provider);
    return;
  }

  const originalBtnText = scanBtn ? scanBtn.textContent : "";
  if (scanBtn) {
    scanBtn.disabled = true;
    scanBtn.textContent = "⏳ Scanning...";
  }

  if (statusElem) {
    statusElem.style.display = "block";
    statusElem.style.color = "var(--apple-blue)";
    statusElem.textContent = "Querying API for verified available models...";
  }

  try {
    const host = provider === "ollama" ? (aiOllamaHost?.value.trim() || "http://localhost:11434") : undefined;
    const apiKey = explicitKey || (
      provider === "anthropic" ? aiAnthropicKey.value.trim() :
      provider === "openai" ? aiOpenAiKey.value.trim() : ""
    );

    const res = await fetch("/api/ai/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey, host })
    });

    const data = await res.json();

    if (data.success && Array.isArray(data.models) && data.models.length > 0) {
      providerModelsCache[provider] = data;

      const currentConfigModel = aiConfig ? (
        provider === "anthropic" ? aiConfig.anthropicModel :
        provider === "openai" ? aiConfig.openaiModel : aiConfig.ollamaModel
      ) : null;

      const previouslySelected = selectElem.value || currentConfigModel;

      selectElem.innerHTML = "";
      data.models.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.name;
        if (m.recommended) opt.dataset.recommended = "true";
        if (m.reason) opt.dataset.reason = m.reason;
        if (m.badge) opt.dataset.badge = m.badge;
        selectElem.appendChild(opt);
      });

      // User flexibility: if user's previously picked model is among the verified available models, keep it!
      // Otherwise, pick the best recommended model.
      const matchExists = data.models.some(m => m.id === previouslySelected);
      if (matchExists && previouslySelected) {
        selectElem.value = previouslySelected;
      } else if (data.recommendedModel) {
        selectElem.value = data.recommendedModel;
      }

      if (statusElem) {
        statusElem.style.display = "block";
        statusElem.style.color = "var(--apple-green)";
        statusElem.textContent = `✅ Found ${data.models.length} active models on your account.`;
        setTimeout(() => {
          if (statusElem) statusElem.style.display = "none";
        }, 4000);
      }

      updateModelHintAndBadge(provider);
    } else {
      if (statusElem) {
        statusElem.style.display = "block";
        statusElem.style.color = "var(--apple-red, #ff453a)";
        statusElem.textContent = data.error || "Could not retrieve models. Check credentials or connection.";
      }
      if (hintElem) hintElem.textContent = "";
      if (btnUseRec) btnUseRec.style.display = "none";
    }
  } catch (err) {
    if (statusElem) {
      statusElem.style.display = "block";
      statusElem.style.color = "var(--apple-red, #ff453a)";
      statusElem.textContent = "Error scanning models.";
    }
  } finally {
    if (scanBtn) {
      scanBtn.disabled = false;
      scanBtn.textContent = originalBtnText || (provider === "ollama" ? "🔍 Detect Models" : "🔍 Scan Available Models");
    }
  }
}

function updateModelHintAndBadge(provider) {
  const selectElem = document.getElementById(
    provider === "anthropic" ? "aiAnthropicModelSelect" :
    provider === "openai" ? "aiOpenAiModelSelect" : "aiOllamaModelSelect"
  );
  const hintElem = document.getElementById(
    provider === "anthropic" ? "anthropicModelHint" :
    provider === "openai" ? "openAiModelHint" : "ollamaModelHint"
  );
  const btnUseRec = document.getElementById(
    provider === "anthropic" ? "btnUseAnthropicRecommended" :
    provider === "openai" ? "btnUseOpenAiRecommended" : "btnUseOllamaRecommended"
  );

  if (!selectElem) return;

  const cache = providerModelsCache[provider];
  const selectedId = selectElem.value;
  const modelInfo = cache?.models?.find(m => m.id === selectedId);
  const recommendedId = cache?.recommendedModel;

  if (hintElem) {
    if (modelInfo) {
      if (modelInfo.recommended) {
        hintElem.innerHTML = `<span style="color: var(--apple-green); font-weight: 600;">✨ Best Recommended:</span> ${modelInfo.reason || "Optimal balance of intelligence, speed, and low token cost."}`;
      } else {
        hintElem.innerHTML = `<span style="color: var(--apple-blue); font-weight: 500;">User Choice:</span> ${modelInfo.badge ? modelInfo.badge + ' · ' : ''}<code>${modelInfo.id}</code>`;
      }
    } else {
      hintElem.textContent = selectedId ? `Selected model: ${selectedId}` : "";
    }
  }

  if (btnUseRec) {
    // Only show button if user has currently picked something different from recommended
    if (recommendedId && selectedId !== recommendedId) {
      btnUseRec.style.display = "inline-block";
      btnUseRec.textContent = `✨ Switch to Recommended (${recommendedId})`;
    } else {
      btnUseRec.style.display = "none";
    }
  }
}

function useRecommendedModel(provider) {
  const cache = providerModelsCache[provider];
  if (!cache || !cache.recommendedModel) return;
  const selectElem = document.getElementById(
    provider === "anthropic" ? "aiAnthropicModelSelect" :
    provider === "openai" ? "aiOpenAiModelSelect" : "aiOllamaModelSelect"
  );
  if (selectElem) {
    selectElem.value = cache.recommendedModel;
    updateModelHintAndBadge(provider);
    showToast(`✨ Set to recommended: ${cache.recommendedModel}`);
  }
}

function openAiModal() {
  if (!aiConfig) return;
  const radio = document.querySelector(`input[name="aiProvider"][value="${aiConfig.provider}"]`);
  if (radio) radio.checked = true;

  ollamaSettings.style.display = aiConfig.provider === "ollama" ? "block" : "none";
  anthropicSettings.style.display = aiConfig.provider === "anthropic" ? "block" : "none";
  openaiSettings.style.display = aiConfig.provider === "openai" ? "block" : "none";

  aiOllamaHost.value = aiConfig.ollamaHost || "http://localhost:11434";
  aiAnthropicKey.value = aiConfig.anthropicApiKey || "";
  aiOpenAiKey.value = aiConfig.openaiApiKey || "";
  aiAnthropicKey.placeholder = aiConfig.hasAnthropicKey ? "Configured · leave blank to keep" : "Anthropic API key (sk-ant-...)";
  aiOpenAiKey.placeholder = aiConfig.hasOpenAiKey ? "Configured · leave blank to keep" : "OpenAI API key (sk-...)";

  // Bind key visibility toggle buttons once
  const btnToggleAnthropicKey = document.getElementById("btnToggleAnthropicKey");
  if (btnToggleAnthropicKey && !btnToggleAnthropicKey.dataset.bound) {
    btnToggleAnthropicKey.dataset.bound = "true";
    btnToggleAnthropicKey.addEventListener("click", () => {
      aiAnthropicKey.type = aiAnthropicKey.type === "password" ? "text" : "password";
      btnToggleAnthropicKey.textContent = aiAnthropicKey.type === "password" ? "👁️" : "🔒";
    });
  }
  const btnToggleOpenAiKey = document.getElementById("btnToggleOpenAiKey");
  if (btnToggleOpenAiKey && !btnToggleOpenAiKey.dataset.bound) {
    btnToggleOpenAiKey.dataset.bound = "true";
    btnToggleOpenAiKey.addEventListener("click", () => {
      aiOpenAiKey.type = aiOpenAiKey.type === "password" ? "text" : "password";
      btnToggleOpenAiKey.textContent = aiOpenAiKey.type === "password" ? "👁️" : "🔒";
    });
  }

  // Bind manual scan buttons once
  const btnScanAnthropicModels = document.getElementById("btnScanAnthropicModels");
  if (btnScanAnthropicModels && !btnScanAnthropicModels.dataset.bound) {
    btnScanAnthropicModels.dataset.bound = "true";
    btnScanAnthropicModels.addEventListener("click", () => scanProviderModels("anthropic", aiAnthropicKey.value.trim(), true));
  }
  const btnScanOpenAiModels = document.getElementById("btnScanOpenAiModels");
  if (btnScanOpenAiModels && !btnScanOpenAiModels.dataset.bound) {
    btnScanOpenAiModels.dataset.bound = "true";
    btnScanOpenAiModels.addEventListener("click", () => scanProviderModels("openai", aiOpenAiKey.value.trim(), true));
  }
  const btnScanOllamaModels = document.getElementById("btnScanOllamaModels");
  if (btnScanOllamaModels && !btnScanOllamaModels.dataset.bound) {
    btnScanOllamaModels.dataset.bound = "true";
    btnScanOllamaModels.addEventListener("click", () => scanProviderModels("ollama", "", true));
  }

  // Bind 'Use Recommended' quick-select buttons once
  const btnUseAnthropicRecommended = document.getElementById("btnUseAnthropicRecommended");
  if (btnUseAnthropicRecommended && !btnUseAnthropicRecommended.dataset.bound) {
    btnUseAnthropicRecommended.dataset.bound = "true";
    btnUseAnthropicRecommended.addEventListener("click", () => useRecommendedModel("anthropic"));
  }
  const btnUseOpenAiRecommended = document.getElementById("btnUseOpenAiRecommended");
  if (btnUseOpenAiRecommended && !btnUseOpenAiRecommended.dataset.bound) {
    btnUseOpenAiRecommended.dataset.bound = "true";
    btnUseOpenAiRecommended.addEventListener("click", () => useRecommendedModel("openai"));
  }
  const btnUseOllamaRecommended = document.getElementById("btnUseOllamaRecommended");
  if (btnUseOllamaRecommended && !btnUseOllamaRecommended.dataset.bound) {
    btnUseOllamaRecommended.dataset.bound = "true";
    btnUseOllamaRecommended.addEventListener("click", () => useRecommendedModel("ollama"));
  }

  // Bind select dropdown changes once so user can freely choose any model
  const anthropicModelSelect = document.getElementById("aiAnthropicModelSelect");
  if (anthropicModelSelect && !anthropicModelSelect.dataset.bound) {
    anthropicModelSelect.dataset.bound = "true";
    anthropicModelSelect.addEventListener("change", () => updateModelHintAndBadge("anthropic"));
  }
  const openAiModelSelect = document.getElementById("aiOpenAiModelSelect");
  if (openAiModelSelect && !openAiModelSelect.dataset.bound) {
    openAiModelSelect.dataset.bound = "true";
    openAiModelSelect.addEventListener("change", () => updateModelHintAndBadge("openai"));
  }
  const ollamaModelSelect = document.getElementById("aiOllamaModelSelect");
  if (ollamaModelSelect && !ollamaModelSelect.dataset.bound) {
    ollamaModelSelect.dataset.bound = "true";
    ollamaModelSelect.addEventListener("change", () => updateModelHintAndBadge("ollama"));
  }

  // Bind API key blur to scan models automatically if user pastes a key
  if (aiAnthropicKey && !aiAnthropicKey.dataset.bound) {
    aiAnthropicKey.dataset.bound = "true";
    aiAnthropicKey.addEventListener("blur", () => {
      const k = aiAnthropicKey.value.trim();
      if (k && k.length > 10) scanProviderModels("anthropic", k, true);
    });
  }
  if (aiOpenAiKey && !aiOpenAiKey.dataset.bound) {
    aiOpenAiKey.dataset.bound = "true";
    aiOpenAiKey.addEventListener("blur", () => {
      const k = aiOpenAiKey.value.trim();
      if (k && k.length > 10) scanProviderModels("openai", k, true);
    });
  }

  testAiConnection();
  aiConfigModal.style.display = "flex";

  // Automatically scan available models for the currently active provider
  if (aiConfig.provider !== "builtin") {
    scanProviderModels(aiConfig.provider);
  }
}

async function testAiConnection() {
  aiHealthIcon.textContent = "⏳";
  aiHealthMsg.textContent = "Probing AI engine...";

  try {
    const res = await fetch("/api/ai/config");
    const data = await res.json();
    if (data.health?.status === "connected") {
      aiHealthIcon.textContent = "🟢";
      aiHealthMsg.textContent = data.health.message;
    } else {
      aiHealthIcon.textContent = "🟡";
      aiHealthMsg.textContent = data.health.message;
    }
  } catch {
    aiHealthIcon.textContent = "🔴";
    aiHealthMsg.textContent = "Connection refused";
  }
}

async function saveAiConfig() {
  const provider = document.querySelector('input[name="aiProvider"]:checked')?.value || "ollama";
  const anthropicModelSelect = document.getElementById("aiAnthropicModelSelect");
  const openAiModelSelect = document.getElementById("aiOpenAiModelSelect");

  const payload = {
    provider,
    ollamaHost: aiOllamaHost.value.trim(),
    ollamaModel: aiOllamaModelSelect.value,
    anthropicModel: anthropicModelSelect?.value || "claude-haiku-4-5-20251001",
    openaiModel: openAiModelSelect?.value || "gpt-4o-mini"
  };
  if (aiAnthropicKey.value.trim()) payload.anthropicApiKey = aiAnthropicKey.value.trim();
  if (aiOpenAiKey.value.trim()) payload.openaiApiKey = aiOpenAiKey.value.trim();

  try {
    const res = await fetch("/api/ai/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      aiConfig = data.config;
      aiConfigModal.style.display = "none";
      showToast("AI engine configuration saved!");
      await fetchAiConfig();
    } else {
      showToast(data.error || "Failed to save AI configuration");
    }
  } catch (err) {
    showToast("Error saving AI configuration");
  }
}

async function handleAutoSelectBestModel() {
  const provider = document.querySelector('input[name="aiProvider"]:checked')?.value || "ollama";
  const apiKey = provider === "openai" ? aiOpenAiKey.value.trim() : provider === "anthropic" ? aiAnthropicKey.value.trim() : "";

  showToast("Scanning live models and selecting best value recommendation...");
  await scanProviderModels(provider, apiKey, true);
  useRecommendedModel(provider);
}

// --------------------------------------------------------------------------
// Job Feed & Application Tailoring
// --------------------------------------------------------------------------

async function fetchJobs() {
  try {
    const res = await fetch("/api/jobs");
    const data = await res.json();
    allJobs = data.jobs || [];
    renderLocationNavFilters();
    updateBadgeCounts();
    renderJobs();

    // Keep selected job or select first
    if (selectedJob) {
      const match = allJobs.find(j => j.id === selectedJob.id || (j.company === selectedJob.company && j.title === selectedJob.title));
      if (match) selectJob(match);
      else if (allJobs.length > 0) selectJob(allJobs[0]);
    } else if (allJobs.length > 0) {
      selectJob(allJobs[0]);
    }
  } catch (err) {
    console.error("Failed to fetch jobs:", err);
    showToast("Error loading jobs");
  }
}

function renderLocationNavFilters() {
  const container = document.getElementById("navListLocations");
  if (!container || !activeProfile) return;

  const cityName = (activeProfile.location || "Candidate").split(",")[0].trim();
  const radius = activeProfile.preferredRadiusMiles || 50;

  // Extract custom target locations (ignoring Remote and Home City)
  const targets = (activeProfile.targetLocations || [])
    .map(t => t.trim())
    .filter(t => t && t.toLowerCase() !== "remote" && !t.toLowerCase().includes(cityName.toLowerCase()));

  let itemsHtml = `
    <li class="nav-item ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">
      <span class="nav-item-left">💼 All Opportunities</span>
      <span class="nav-badge" id="countAll">0</span>
    </li>
    <li class="nav-item ${currentFilter === 'remote' ? 'active' : ''}" data-filter="remote">
      <span class="nav-item-left">🌐 Priority 1: Remote (UK)</span>
      <span class="nav-badge" id="countRemote">0</span>
    </li>
    <li class="nav-item ${currentFilter === 'nearby' || currentFilter === 'hartlepool_radius' ? 'active' : ''}" data-filter="nearby">
      <span class="nav-item-left" id="navLabelNear">📍 Priority 2: Near ${escapeHtml(cityName)} (~${radius}mi)</span>
      <span class="nav-badge" id="countNear">0</span>
    </li>
  `;

  let rankNum = 3;
  targets.forEach((targetCity, idx) => {
    const filterKey = `target_loc_${targetCity.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    itemsHtml += `
      <li class="nav-item ${currentFilter === filterKey ? 'active' : ''}" data-filter="${filterKey}" data-target-city="${escapeHtml(targetCity)}">
        <span class="nav-item-left">🎯 Priority ${rankNum}: ${escapeHtml(targetCity)}</span>
        <span class="nav-badge" id="count_loc_${idx}">0</span>
      </li>
    `;
    rankNum++;
  });

  itemsHtml += `
    <li class="nav-item ${currentFilter === 'uk_hybrid_sponsored' ? 'active' : ''}" data-filter="uk_hybrid_sponsored">
      <span class="nav-item-left">🇬🇧 Nationwide · Licensed</span>
      <span class="nav-badge" id="countUkHybridSponsored">0</span>
    </li>
  `;

  container.innerHTML = itemsHtml;

  // Re-attach event listeners
  container.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      currentFilter = item.dataset.filter;
      renderJobs();
    });
  });

  updateBadgeCounts();
}

function updateBadgeCounts() {
  const total = allJobs.length;
  const radius = activeProfile?.preferredRadiusMiles || 50;
  const remote = allJobs.filter(j => j.is_remote).length;
  const near = allJobs.filter(j => j.distance_miles <= radius && !j.is_remote).length;
  const ukHybridSponsored = allJobs.filter(j => !j.is_remote && j.sponsor_verified).length;
  const drafted = allJobs.filter(j => j.status === "drafted").length;
  const applied = allJobs.filter(j => j.status === "applied").length;
  const sponsors = allJobs.filter(j => j.sponsor_verified).length;
  const explicitSponsors = allJobs.filter(j => j.sponsor_verified && j.sponsorship_status === "offered").length;

  const countAllEl = document.getElementById("countAll");
  const countRemoteEl = document.getElementById("countRemote");
  const countNearEl = document.getElementById("countNear");
  const countUkHybridSponsoredEl = document.getElementById("countUkHybridSponsored");
  const countDraftedEl = document.getElementById("countDrafted");
  const countAppliedEl = document.getElementById("countApplied");
  const countSponsorsEl = document.getElementById("countSponsors");
  const countExplicitSponsorsEl = document.getElementById("countExplicitSponsors");

  if (countAllEl) countAllEl.textContent = total;
  if (countRemoteEl) countRemoteEl.textContent = remote;
  if (countNearEl) countNearEl.textContent = near;
  if (countUkHybridSponsoredEl) countUkHybridSponsoredEl.textContent = ukHybridSponsored;
  if (countDraftedEl) countDraftedEl.textContent = drafted;
  if (countAppliedEl) countAppliedEl.textContent = applied;
  if (countSponsorsEl) countSponsorsEl.textContent = sponsors;
  if (countExplicitSponsorsEl) countExplicitSponsorsEl.textContent = explicitSponsors;

  // Update dynamic target location counts
  const cityName = (activeProfile?.location || "").split(",")[0].trim().toLowerCase();
  const targets = (activeProfile?.targetLocations || [])
    .map(t => t.trim())
    .filter(t => t && t.toLowerCase() !== "remote" && !t.toLowerCase().includes(cityName));

  targets.forEach((targetCity, idx) => {
    const el = document.getElementById(`count_loc_${idx}`);
    if (el) {
      const c = allJobs.filter(j => j.location.toLowerCase().includes(targetCity.toLowerCase())).length;
      el.textContent = c;
    }
  });

  const ratio = total > 0 ? Math.round((sponsors / total) * 100) : 100;
  if (sponsorStatRatio) sponsorStatRatio.textContent = `${ratio}%`;
}

function filterJobsList() {
  const query = (searchInput.value || "").toLowerCase().trim();
  const radius = activeProfile?.preferredRadiusMiles || 50;

  const matched = allJobs.filter(j => {
    // Search match
    const matchSearch = !query ||
      j.title.toLowerCase().includes(query) ||
      j.company.toLowerCase().includes(query) ||
      j.location.toLowerCase().includes(query) ||
      (j.key_skills || []).some(s => s.toLowerCase().includes(query));

    if (!matchSearch) return false;

    if (scenarioFeedFilters.location && scenarioFeedFilters.location.toLowerCase() !== "remote" && !j.location.toLowerCase().includes(scenarioFeedFilters.location.toLowerCase())) return false;
    if (scenarioFeedFilters.minSalary) {
      const salaryNumbers = String(j.salary || "").replace(/,/g, "").match(/\d{4,6}/g)?.map(Number) || [];
      const advertisedMaximum = salaryNumbers.length ? Math.max(...salaryNumbers) : 0;
      if (!advertisedMaximum || advertisedMaximum < scenarioFeedFilters.minSalary) return false;
    }
    if (scenarioFeedFilters.sponsorshipMode === "licensed" && !j.sponsor_verified) return false;
    if (scenarioFeedFilters.sponsorshipMode === "explicit" && !(j.sponsor_verified && j.sponsorship_status === "offered")) return false;

    // Filter match
    if (currentFilter === "remote") return j.is_remote;
    if (currentFilter === "nearby" || currentFilter === "hartlepool_radius") return j.distance_miles <= radius && !j.is_remote;
    if (currentFilter === "scotland") return j.location.toLowerCase().includes("edinburgh") || j.location.toLowerCase().includes("glasgow");
    if (currentFilter.startsWith("target_loc_")) {
      const activeNav = document.querySelector(`.nav-item[data-filter="${currentFilter}"]`);
      const targetCity = activeNav?.dataset.targetCity?.toLowerCase();
      if (targetCity) {
        return j.location.toLowerCase().includes(targetCity);
      }
    }
    if (currentFilter === "uk_hybrid_sponsored") return !j.is_remote && j.sponsor_verified;
    if (currentFilter === "drafted") return j.status === "drafted";
    if (currentFilter === "applied") return j.status === "applied";
    if (currentFilter === "sponsor_verified") return j.sponsor_verified;
    if (currentFilter === "sponsorship_explicit") return j.sponsor_verified && j.sponsorship_status === "offered";

    return true;
  });

  return matched.sort((a, b) => {
    if (currentSortMode === "days") {
      // Days wise: newest posted_date first, then fit_score
      const dateA = a.posted_date || "2026-01-01";
      const dateB = b.posted_date || "2026-01-01";
      if (dateB !== dateA) return dateB.localeCompare(dateA);
      return (b.fit_score || 0) - (a.fit_score || 0);
    } else if (currentSortMode === "score") {
      // Percentage score wise: highest fit_score first, then newest date
      const scoreDiff = (b.fit_score || 0) - (a.fit_score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const dateA = a.posted_date || "2026-01-01";
      const dateB = b.posted_date || "2026-01-01";
      return dateB.localeCompare(dateA);
    } else if (currentSortMode === "pipeline") {
      // Status priority (applied > drafted > unapplied), then date, then score
      const statusRank = (s) => s === "applied" ? 3 : s === "drafted" ? 2 : 1;
      const rankDiff = statusRank(b.status) - statusRank(a.status);
      if (rankDiff !== 0) return rankDiff;
      const dateA = a.posted_date || "2026-01-01";
      const dateB = b.posted_date || "2026-01-01";
      if (dateB !== dateA) return dateB.localeCompare(dateA);
      return (b.fit_score || 0) - (a.fit_score || 0);
    }
    return 0;
  });
}

function renderJobs() {
  const filtered = filterJobsList();
  feedCount.textContent = `${filtered.length} roles`;

  const cityName = activeProfile?.location?.split(",")[0] || "Candidate";
  const radius = activeProfile?.preferredRadiusMiles || 50;

  const filterNames = {
    all: "All Opportunities",
    remote: "Priority 1: Remote (UK)",
    nearby: `Priority 2: Near ${cityName} (~${radius}mi)`,
    hartlepool_radius: `Priority 2: Near ${cityName} (~${radius}mi)`,
    scotland: "Edinburgh & Glasgow",
    uk_hybrid_sponsored: "🇬🇧 Nationwide · Licensed Employers",
    drafted: "Drafted Applications",
    applied: "Applied & Active",
    sponsor_verified: "Licensed Employers",
    sponsorship_explicit: "Vacancies Stating Sponsorship"
  };

  let titleText = filterNames[currentFilter];
  if (!titleText && currentFilter.startsWith("target_loc_")) {
    const activeNav = document.querySelector(`.nav-item[data-filter="${currentFilter}"]`);
    const targetCity = activeNav?.dataset.targetCity || "Target Location";
    titleText = `Priority: ${targetCity}`;
  }
  feedTitle.textContent = titleText || "All Opportunities";

  jobListEl.innerHTML = "";

  if (filtered.length === 0) {
    jobListEl.innerHTML = `
      <div style="text-align: center; color: var(--text-tertiary); padding: 40px 10px; font-size: 13px;">
        No postings match the current filter or search.
      </div>
    `;
    return;
  }

  filtered.forEach(job => {
    const card = document.createElement("div");
    card.className = `job-card ${selectedJob && selectedJob.id === job.id ? 'active' : ''}`;
    
    // Status Badge
    let statusBadge = "";
    if (job.status === "applied") {
      statusBadge = '<span class="status-badge applied">Applied</span>';
    } else if (job.status === "drafted") {
      statusBadge = '<span class="status-badge drafted">CV Ready</span>';
    }

    const relativeDateBadge = formatRelativeDate(job.posted_date);
    const portalNames = {
      "freehire-ats": "Direct ATS", "linkedin-search": "LinkedIn", "cv-library": "CV-Library",
      reed: "Reed", "google-jobs": "Google Jobs", adzuna: "Adzuna", jobicy: "Jobicy",
      arbeitnow: "Arbeitnow", remotive: "Remotive", "external-url": "Imported",
    };
    const portalTag = `<span class="meta-pill" style="color: #93c5fd; border-color: rgba(147,197,253,0.3); font-weight: 500;">${escapeHtml(portalNames[job.portal] || job.portal || "Source")}</span>`;
    const scoreLabel = job.fit_score > 0 ? `${job.fit_score}% match` : "Needs full JD";

    card.innerHTML = `
      <div class="job-card-header">
        <div class="job-card-title">${escapeHtml(job.title)}</div>
        <div class="job-card-fit">${scoreLabel}</div>
      </div>
      <div class="job-card-company">${escapeHtml(job.company)}</div>
      <div class="job-card-meta">
        ${relativeDateBadge}
        ${portalTag}
        <span class="meta-pill">${escapeHtml(job.commute_tag)}</span>
        ${job.sponsorship_status === "offered" && job.sponsor_verified ? '<span class="meta-pill sponsor">✓ Sponsorship stated</span>' : job.sponsor_verified ? '<span class="meta-pill sponsor">🛡️ Licensed employer</span>' : ''}
        ${statusBadge}
      </div>
    `;

    card.addEventListener("click", () => selectJob(job));
    jobListEl.appendChild(card);
  });
}

function formatRelativeDate(dateStr) {
  if (!dateStr) return "";
  try {
    const today = new Date();
    const parts = dateStr.split("-");
    if (parts.length < 3) return `<span class="meta-pill">${dateStr}</span>`;
    const posted = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const diffMs = today.getTime() - posted.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return `<span class="meta-pill" style="color: var(--apple-green); border-color: rgba(48, 209, 88, 0.4); font-weight: 600;">🔥 Today</span>`;
    if (diffDays === 1) return `<span class="meta-pill" style="color: #ffd60a; border-color: rgba(255, 214, 10, 0.4); font-weight: 600;">⚡ 1d ago</span>`;
    if (diffDays <= 3) return `<span class="meta-pill" style="color: #64d2ff; border-color: rgba(100, 210, 255, 0.35); font-weight: 500;">${diffDays}d ago</span>`;
    if (diffDays <= 7) return `<span class="meta-pill" style="font-weight: 500;">${diffDays}d ago</span>`;
    return `<span class="meta-pill" style="opacity: 0.65;">${dateStr}</span>`;
  } catch {
    return `<span class="meta-pill">${dateStr}</span>`;
  }
}

function selectJob(job) {
  selectedJob = job;

  document.querySelectorAll(".job-card").forEach(c => c.classList.remove("active"));
  renderJobs();

  // Update Studio Header
  studioJobTitle.textContent = job.title;
  studioCompanyName.textContent = job.company;
  studioLocation.textContent = ` · ${job.location} (~${job.distance_miles} mi)`;

  const atsBadge = document.getElementById("studioAtsBadge");
  const atsScore = document.getElementById("studioAtsScore");
  if (atsBadge && atsScore) {
    atsScore.textContent = job.fit_score > 0 ? `${job.fit_score}%` : "Needs JD";
    atsBadge.style.display = "inline-flex";
  }

  if (job.url) {
    studioLinkBtn.href = job.url;
    studioLinkBtn.style.display = "inline-flex";
    studioLinkBtn.textContent = "Open original listing ↗";
  } else {
    studioLinkBtn.style.display = "none";
  }

  // Sponsor Banner
  if (job.sponsor_verified) {
    studioSponsorBanner.style.display = "flex";
    studioSponsorText.textContent = job.sponsorship_status === "offered"
      ? `Licensed employer · this vacancy states sponsorship is offered`
      : `Licensed employer · this vacancy does not confirm sponsorship`;
  } else {
    studioSponsorBanner.style.display = "none";
  }

  // Actions Bar
  studioActionsBar.style.display = "flex";
  studioTabs.style.display = "flex";

  if (job.status === "applied") {
    btnMarkApplied.textContent = "✅ Applied";
    btnMarkApplied.disabled = true;
  } else {
    btnMarkApplied.textContent = "✅ Mark as Applied";
    btnMarkApplied.disabled = false;
  }

  // Auto-hydrate complete Job Description if missing or short
  if ((!job.full_jd || job.full_jd.length < 150) && job.url) {
    fetch("/api/jobs/hydrate-jd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.fullJd && selectedJob && selectedJob.id === job.id) {
          selectedJob.full_jd = data.fullJd;
          if (data.analysis) {
            selectedJob.analysis = data.analysis;
            selectedJob.fit_score = data.analysis.overallScore;
            const scoreEl = document.getElementById("studioAtsScore");
            if (scoreEl) scoreEl.textContent = `${data.analysis.overallScore}%`;
          }
          if (currentTab === "tab-details") {
            renderDetailsTab();
          }
        }
      })
      .catch(() => {});
  }

  renderStudioTabContent();
}

function renderStudioTabContent() {
  if (!selectedJob) return;

  if (currentTab === "tab-cv") {
    renderCVTab();
  } else if (currentTab === "tab-cover") {
    renderCoverTab();
  } else if (currentTab === "tab-details") {
    renderDetailsTab();
  } else if (currentTab === "tab-answers") {
    renderAnswersTab();
  }
}

let currentCVViewMode = "visual";
let currentCoverViewMode = "visual";

async function renderCVTab() {
  const cvPath = selectedJob.cv_file || "";

  studioContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; max-width: 820px; margin-left: auto; margin-right: auto;">
      <div style="font-size: 13px; color: var(--text-secondary);">
        <b>Format:</b> Jake Gutierrez ATS Single-Page (100% Parsable Unicode)
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn-primary" id="btnDownloadCVPdf">Download PDF</button>
        <button class="btn-secondary" id="btnOpenPreviewCV" title="Open PDF with the system viewer">Open</button>
        <button class="btn-secondary" id="btnRevealCV" title="Show PDF in its folder">Show in folder</button>
        <button class="btn-secondary" id="btnToggleCVMode">${currentCVViewMode === "visual" ? "📝 Raw LaTeX" : "📄 Visual View"}</button>
        <button class="btn-secondary" id="btnCopyCV">📋 Copy LaTeX</button>
        <button class="btn-secondary" id="btnOpenOverleaf">Open Overleaf ↗</button>
      </div>
    </div>
    <div id="cvContainer" style="max-width: 820px; margin: 0 auto;">
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">Loading tailored CV...</div>
    </div>
  `;

  document.getElementById("btnOpenOverleaf")?.addEventListener("click", () => window.open("https://www.overleaf.com/project", "_blank"));
  document.getElementById("btnDownloadCVPdf")?.addEventListener("click", () => downloadPDF("cv"));
  document.getElementById("btnOpenPreviewCV")?.addEventListener("click", () => openInPreview("cv"));
  document.getElementById("btnRevealCV")?.addEventListener("click", () => revealInFinder("cv"));

  let texCode = "";
  if (cvPath) {
    try {
      const res = await fetch(`/api/document?path=${encodeURIComponent(cvPath)}`);
      if (res.ok) {
        const data = await res.json();
        texCode = data.content || "";
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (!texCode) {
    document.getElementById("cvContainer").innerHTML = `
      <div style="text-align: center; padding: 50px 20px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px dashed var(--border-strong);">
        <h3 style="font-size: 16px; margin-bottom: 8px;">Tailored CV not yet generated for ${selectedJob.company}</h3>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">Click the button below to curate and generate a bespoke ATS CV for candidate <b>${escapeHtml(activeProfile?.name || 'Candidate')}</b>.</p>
        <button class="btn-primary" style="margin: 0 auto;" onclick="tailorCurrentJob()">⚡ Generate Bespoke CV Now</button>
      </div>
    `;
    return;
  }

  document.getElementById("btnCopyCV")?.addEventListener("click", () => {
    navigator.clipboard.writeText(texCode);
    showToast("LaTeX CV code copied to clipboard!");
  });

  document.getElementById("btnToggleCVMode")?.addEventListener("click", () => {
    currentCVViewMode = currentCVViewMode === "visual" ? "code" : "visual";
    renderCVTab();
  });

  if (currentCVViewMode === "code") {
    document.getElementById("cvContainer").innerHTML = `
      <div class="doc-latex-box" style="max-height: 700px; font-size: 12px;">${escapeHtml(texCode)}</div>
    `;
    return;
  }

  // Visual Parsing
  const parsed = parseLatexCV(texCode);
  const headlineRole = cleanCandidateHeadline(selectedJob.title, activeProfile?.headline);

  // Fallback to activeProfile experience if LaTeX returned empty
  const expToRender = (parsed.experience && parsed.experience.length > 0)
    ? parsed.experience
    : (activeProfile?.experience || []).map(exp => ({
        company: exp.company,
        location: exp.location,
        title: exp.role,
        dates: `${exp.startDate} – ${exp.endDate}`,
        items: exp.bullets || []
      }));

  // Fallback to activeProfile projects if LaTeX returned empty
  const projectsToRender = (parsed.projects && parsed.projects.length > 0)
    ? parsed.projects
    : ((activeProfile?.projects || []).map(p => ({
        name: p.name,
        tools: p.tools,
        category: p.category,
        items: p.bullets || []
      })));

  const summaryToRender = parsed.summary || activeProfile?.summary || "";

  // Format skills fallback if not parsed
  let skillsTextToRender = parsed.skillsHtml;
  if (!skillsTextToRender && activeProfile?.skills) {
    const s = activeProfile.skills;
    const parts = [];
    if (s.cloud && s.cloud.length) parts.push(`Cloud Platforms: ${s.cloud.join(", ")}`);
    if (s.containers && s.containers.length) parts.push(`Containers & GitOps: ${s.containers.join(", ")}`);
    else if (s.devops && s.devops.length) parts.push(`Containers & GitOps: ${s.devops.join(", ")}`);
    if (s.iac && s.iac.length) parts.push(`Infrastructure as Code: ${s.iac.join(", ")}`);
    if (s.cicd && s.cicd.length) parts.push(`CI/CD & Build Tools: ${s.cicd.join(", ")}`);
    if (s.monitoring && s.monitoring.length) parts.push(`Monitoring & SRE: ${s.monitoring.join(", ")}`);
    if (s.security && s.security.length) parts.push(`Security: ${s.security.join(", ")}`);
    if (s.languages && s.languages.length) parts.push(`Languages & Frameworks: ${s.languages.join(", ")}`);
    if (s.tools && s.tools.length) parts.push(`Tools & Automation: ${s.tools.join(", ")}`);
    skillsTextToRender = parts.join("\n");
  }

  document.getElementById("cvContainer").innerHTML = `
    <div class="doc-preview-container">
      <div class="doc-header">
        <h1>${escapeHtml(activeProfile?.name || "Candidate")}</h1>
        <h3>${escapeHtml(headlineRole)}</h3>
        <div class="doc-contact">
          ${escapeHtml(activeProfile?.location || "")} · ${escapeHtml(activeProfile?.phone || "")} · ${escapeHtml(activeProfile?.email || "")}
          ${activeProfile?.linkedin ? ` · <a href="${escapeHtml(activeProfile.linkedin)}" target="_blank" style="color: var(--apple-blue);">LinkedIn</a>` : ''}
          ${activeProfile?.github ? ` · <a href="${escapeHtml(activeProfile.github)}" target="_blank" style="color: var(--apple-blue);">GitHub</a>` : ''}
        </div>
      </div>

      ${summaryToRender ? `
      <div class="doc-section">
        <div class="doc-section-title">Professional Summary</div>
        <p style="font-size: 12px; color: #1f2937; line-height: 1.55;">${escapeHtml(summaryToRender)}</p>
      </div>` : ''}

      ${expToRender.length > 0 ? `
      <div class="doc-section">
        <div class="doc-section-title">Work Experience</div>
        ${expToRender.map(exp => `
          <div style="margin-top: 10px;">
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 12.5px; color: #111827;">
              <span>${escapeHtml(exp.company)}</span>
              <span>${escapeHtml(exp.dates)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-style: italic; font-size: 11.5px; color: #4b5563; margin-bottom: 5px;">
              <span>${escapeHtml(exp.title)}</span>
              <span>${escapeHtml(exp.location)}</span>
            </div>
            <ul class="doc-bullet-list">
              ${exp.items.map(bullet => `<li>${escapeHtml(bullet)}</li>`).join("")}
            </ul>
          </div>
        `).join("")}
      </div>` : ''}

      ${skillsTextToRender ? `
      <div class="doc-section">
        <div class="doc-section-title">Technical Skills</div>
        <div style="font-size: 12px; color: #1f2937; line-height: 1.6; white-space: pre-line;">${escapeHtml(skillsTextToRender)}</div>
      </div>` : ''}

      ${projectsToRender.length > 0 ? `
      <div class="doc-section">
        <div class="doc-section-title">Technical Projects</div>
        ${projectsToRender.map(proj => `
          <div style="margin-top: 10px;">
            <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 12px; color: #111827;">
              <span><b>${escapeHtml(proj.name)}</b> ${proj.tools ? `<span style="font-weight: normal; font-style: italic; color: #4b5563;">| ${escapeHtml(proj.tools)}</span>` : ''}</span>
              <span style="font-size: 11px; color: #6b7280;">${escapeHtml(proj.category || "")}</span>
            </div>
            <ul class="doc-bullet-list">
              ${proj.items.map(bullet => `<li>${escapeHtml(bullet)}</li>`).join("")}
            </ul>
          </div>
        `).join("")}
      </div>` : ''}

      <div class="doc-section">
        <div class="doc-section-title">Education & Credentials</div>
        <div style="font-size: 12px; color: #1f2937; line-height: 1.5;">
          ${(activeProfile?.education || []).map(e => `<b>${escapeHtml(e.degree)}</b> — ${escapeHtml(e.institution)} (${escapeHtml(e.startDate)} – ${escapeHtml(e.endDate)})<br>`).join("")}
        </div>
      </div>

      ${(activeProfile?.certifications && activeProfile.certifications.length > 0) ? `
      <div class="doc-section">
        <div class="doc-section-title">Certifications & Accreditations</div>
        <div style="font-size: 12px; color: #1f2937; line-height: 1.5;">
          ${activeProfile.certifications.map(c => `<b>${escapeHtml(c.name)}</b> — ${escapeHtml(c.issuer)}${c.year ? ` (${escapeHtml(c.year)})` : ''}`).join(" &nbsp;|&nbsp; ")}
        </div>
      </div>` : ''}
    </div>
  `;
}

function extractCoverParagraphs(texCode) {
  const body = (texCode.match(/Dear\s+(?:Hiring Manager|Hiring Team)[\s\S]*?(?=\\end\{document\})/i) || [""])[0];
  if (!body) return [];
  return body
    .replace(/%.*$/gm, "")
    .replace(/\\par\b/g, "\n\n")
    .replace(/\\\\/g, "\n")
    .replace(/\\(?:textbf|textit|emph|Large|large|small)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\href\{[^}]*\}\{([^}]*)\}/g, "$1")
    .replace(/\\([&%$#_{}])/g, "$1")
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, "")
    .replace(/[{}]/g, "")
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function renderCoverTab() {
  const coverPath = selectedJob.cover_file || "";

  studioContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; max-width: 820px; margin-left: auto; margin-right: auto;">
      <div style="font-size: 13px; color: var(--text-secondary);">
        <b>Format:</b> Executive Formal Letterhead (Targeted to ${escapeHtml(selectedJob.company)})
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn-primary" id="btnDownloadCoverPdf">Download PDF</button>
        <button class="btn-secondary" id="btnOpenPreviewCover" title="Open PDF with the system viewer">Open</button>
        <button class="btn-secondary" id="btnRevealCover" title="Show PDF in its folder">Show in folder</button>
        <button class="btn-secondary" id="btnToggleCoverMode">${currentCoverViewMode === "visual" ? "📝 Raw LaTeX" : "📄 Visual View"}</button>
        <button class="btn-secondary" id="btnCopyCover">📋 Copy LaTeX</button>
      </div>
    </div>
    <div id="coverContainer" style="max-width: 820px; margin: 0 auto;">
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">Loading cover letter...</div>
    </div>
  `;

  document.getElementById("btnDownloadCoverPdf")?.addEventListener("click", () => downloadPDF("cover"));
  document.getElementById("btnOpenPreviewCover")?.addEventListener("click", () => openInPreview("cover"));
  document.getElementById("btnRevealCover")?.addEventListener("click", () => revealInFinder("cover"));

  let texCode = "";
  if (coverPath) {
    try {
      const res = await fetch(`/api/document?path=${encodeURIComponent(coverPath)}`);
      if (res.ok) {
        const data = await res.json();
        texCode = data.content || "";
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (!texCode) {
    document.getElementById("coverContainer").innerHTML = `
      <div style="text-align: center; padding: 50px 20px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px dashed var(--border-strong);">
        <h3 style="font-size: 16px; margin-bottom: 8px;">Cover Letter not yet generated</h3>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">Generate tailored materials to view the bespoke cover letter for ${selectedJob.company}.</p>
        <button class="btn-primary" style="margin: 0 auto;" onclick="tailorCurrentJob()">⚡ Generate Bespoke Cover Letter Now</button>
      </div>
    `;
    return;
  }

  document.getElementById("btnCopyCover")?.addEventListener("click", () => {
    navigator.clipboard.writeText(texCode);
    showToast("Cover Letter code copied!");
  });

  document.getElementById("btnToggleCoverMode")?.addEventListener("click", () => {
    currentCoverViewMode = currentCoverViewMode === "visual" ? "code" : "visual";
    renderCoverTab();
  });

  if (currentCoverViewMode === "code") {
    document.getElementById("coverContainer").innerHTML = `
      <div class="doc-latex-box" style="max-height: 700px; font-size: 12px;">${escapeHtml(texCode)}</div>
    `;
    return;
  }

  // Visual View
  const todayStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const cleanRole = cleanCandidateHeadline(selectedJob.title, activeProfile?.headline);
  const coverParagraphs = extractCoverParagraphs(texCode);

  document.getElementById("coverContainer").innerHTML = `
    <div class="doc-preview-container" style="padding: 45px 55px; line-height: 1.7; font-size: 13.5px; color: #1f2937;">
      <div class="doc-header" style="text-align: left; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 24px;">
        <h1 style="font-size: 20px;">${escapeHtml(activeProfile?.name || "Candidate")}</h1>
        <h3 style="font-size: 13.5px; color: #4b5563;">${escapeHtml(activeProfile?.headline || "")}</h3>
        <div class="doc-contact" style="font-size: 11.5px; color: #6b7280; margin-top: 4px;">
          ${escapeHtml(activeProfile?.location || "")} · ${escapeHtml(activeProfile?.phone || "")} · ${escapeHtml(activeProfile?.email || "")}
        </div>
      </div>

      <div style="margin-bottom: 18px; color: #4b5563;">${todayStr}</div>

      <div style="margin-bottom: 20px;">
        <b>Hiring Team</b><br>
        ${escapeHtml(selectedJob.company)}<br>
        ${escapeHtml(selectedJob.location)}
      </div>

      <div style="margin-bottom: 16px; font-weight: 700; font-size: 14px; color: #111827;">
        Application for ${escapeHtml(cleanRole)}
      </div>

      ${coverParagraphs.length
        ? coverParagraphs.map((paragraph, index) => `<p style="margin-bottom:${index === coverParagraphs.length - 1 ? "24px" : "14px"};">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("")
        : `<p style="margin-bottom:24px;">The generated cover letter could not be previewed. Switch to Raw LaTeX to review the source.</p>`}
    </div>
  `;
}

function renderDetailsTab() {
  const jdText = selectedJob.full_jd || selectedJob.summary || "Full Job Description not available.";
  const analysis = selectedJob.analysis || {};
  const fitScore = Number(analysis.overallScore ?? selectedJob.fit_score ?? 0);
  const verdict = analysis.verdict || "Not scored";

  const techScore = Number(analysis.dimensions?.technical?.score ?? 0);
  const techNote = analysis.dimensions?.technical?.note || "Not scored. Add the complete job description.";
  const expScore = Number(analysis.dimensions?.experience?.score ?? 0);
  const expNote = analysis.dimensions?.experience?.note || "Not scored. Add the complete job description.";
  const behScore = Number(analysis.dimensions?.behavioral?.score ?? 0);
  const behNote = analysis.dimensions?.behavioral?.note || "No behavioral evidence has been scored.";

  const locVerdict = analysis.gates?.location?.verdict || "UNVERIFIED";
  const eligVerdict = analysis.gates?.eligibility?.verdict || (selectedJob.sponsor_verified ? "PASS" : "UNVERIFIED");

  // Matched vs Gap skills
  const matchedSkills = analysis.matchedKeywords?.length 
    ? analysis.matchedKeywords 
    : [];
  const gapSkills = analysis.gapKeywords?.length 
    ? analysis.gapKeywords 
    : [];

  studioContent.innerHTML = `
    <div style="max-width: 860px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px;">
      
      <!-- ATS Compatibility Overview Header -->
      <div class="ats-overview-card">
        <div>
          <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #34d399; letter-spacing: 0.5px;">ATS Compatibility Assessment</div>
          <div class="ats-overall-number">
            🎯 ${fitScore}% Match
            <span style="font-size: 13.5px; font-weight: 600; color: #34d399; margin-left: 8px;">
              ✨ ${verdict}
            </span>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
            Benchmarked for <b>${escapeHtml(activeProfile?.name || "Candidate")}</b> against <b>${escapeHtml(selectedJob.company)}</b>
          </div>
        </div>
        <div style="text-align: right;">
          <div class="meta-pill" style="font-size: 12px; padding: 5px 12px; background: rgba(10, 132, 255, 0.15); border-color: rgba(10, 132, 255, 0.35); color: #93c5fd;">
            ${escapeHtml(selectedJob.title)}
          </div>
        </div>
      </div>

      <!-- 5-Dimension ATS Radar Scorecard -->
      <div class="ats-scorecard">
        <div style="font-size: 13px; font-weight: 700; color: var(--text-primary); display: flex; justify-content: space-between;">
          <span>Multi-Dimensional Competency & Gate Evaluation</span>
          <span style="font-size: 11px; font-weight: normal; color: var(--text-tertiary);">Grounded Evidence Engine</span>
        </div>

        <div class="ats-radar-grid">
          <!-- 1. Technical -->
          <div class="ats-dim-card">
            <div class="ats-dim-header">🛠️ Technical Stack</div>
            <div class="ats-dim-score">${techScore}%</div>
            <div class="ats-dim-bar"><div class="ats-dim-fill" style="width: ${techScore}%; background: #34d399;"></div></div>
            <div class="ats-dim-note">${escapeHtml(techNote)}</div>
          </div>

          <!-- 2. Experience -->
          <div class="ats-dim-card">
            <div class="ats-dim-header">💼 Experience & Level</div>
            <div class="ats-dim-score">${expScore}%</div>
            <div class="ats-dim-bar"><div class="ats-dim-fill" style="width: ${expScore}%; background: var(--apple-blue);"></div></div>
            <div class="ats-dim-note">${escapeHtml(expNote)}</div>
          </div>

          <!-- 3. Behavioral -->
          <div class="ats-dim-card">
            <div class="ats-dim-header">🤝 Behavioral & SRE</div>
            <div class="ats-dim-score">${behScore}%</div>
            <div class="ats-dim-bar"><div class="ats-dim-fill" style="width: ${behScore}%; background: #bf5af2;"></div></div>
            <div class="ats-dim-note">${escapeHtml(behNote)}</div>
          </div>

          <!-- 4. Location Gate -->
          <div class="ats-dim-card">
            <div class="ats-dim-header">📍 Location Gate</div>
            <div class="ats-dim-score" style="color: ${locVerdict === 'PASS' ? '#34d399' : '#ff9f0a'};">${locVerdict}</div>
            <div class="ats-dim-bar"><div class="ats-dim-fill" style="width: 100%; background: ${locVerdict === 'PASS' ? '#34d399' : '#ff9f0a'};"></div></div>
            <div class="ats-dim-note">${escapeHtml(selectedJob.commute_tag)} (~${selectedJob.distance_miles} mi)</div>
          </div>

          <!-- 5. Visa Sponsorship Gate -->
          <div class="ats-dim-card">
            <div class="ats-dim-header">🛡️ Visa Gate</div>
            <div class="ats-dim-score" style="color: ${selectedJob.sponsorship_status === 'offered' && selectedJob.sponsor_verified ? '#34d399' : '#38bdf8'};">
              ${selectedJob.sponsorship_status === 'offered' && selectedJob.sponsor_verified ? "OFFERED" : selectedJob.sponsor_verified ? "LICENSED" : "VERIFY"}
            </div>
            <div class="ats-dim-bar"><div class="ats-dim-fill" style="width: 100%; background: ${selectedJob.sponsorship_status === 'offered' && selectedJob.sponsor_verified ? '#34d399' : '#38bdf8'};"></div></div>
            <div class="ats-dim-note">${selectedJob.sponsorship_status === 'offered' && selectedJob.sponsor_verified ? "Vacancy wording and register match" : selectedJob.sponsor_verified ? "Employer licensed; vacancy not confirmed" : "Register check recommended"}</div>
          </div>
        </div>

        <!-- Skills Breakdown -->
        <div style="border-top: 1px solid var(--border-subtle); padding-top: 14px; margin-top: 4px;">
          <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #cbd5e1;">Matched Core Competencies (${matchedSkills.length}):</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
            ${matchedSkills.map(s => `<span style="padding: 3px 9px; background: rgba(48, 209, 88, 0.18); border: 1px solid rgba(48, 209, 88, 0.35); color: #34d399; border-radius: 4px; font-size: 11.5px; font-weight: 600;">✓ ${escapeHtml(s)}</span>`).join("")}
            ${matchedSkills.length === 0 ? '<span style="font-size: 12px; color: #94a3b8;">No verified matches yet. Add the complete job description.</span>' : ''}
          </div>

          ${gapSkills.length > 0 ? `
          <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #cbd5e1;">Target Focus / Complementary Keywords (${gapSkills.length}):</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${gapSkills.map(s => `<span style="padding: 3px 9px; background: rgba(255, 214, 10, 0.12); border: 1px solid rgba(255, 214, 10, 0.3); color: #fde047; border-radius: 4px; font-size: 11.5px;">+ ${escapeHtml(s)}</span>`).join("")}
          </div>` : ''}
        </div>
      </div>

      <!-- Verified UK Home Office Sponsorship Assessment -->
      <div class="sponsor-detail-card">
        <span style="font-size: 24px;">🛡️</span>
        <div style="flex: 1;">
          <div class="sponsor-detail-title">
            ${selectedJob.sponsor_verified ? "GOV.UK Licensed Employer" : "UK Right to Work & Visa Assessment"}
          </div>
          <div class="sponsor-detail-text">
            <b>Employer:</b> ${escapeHtml(selectedJob.company)} &nbsp;·&nbsp; 
            <b>License Type:</b> ${escapeHtml(selectedJob.sponsor_label)} &nbsp;·&nbsp;
            <b>Status:</b> ${selectedJob.sponsorship_status === "offered" && selectedJob.sponsor_verified ? "Employer is licensed and the vacancy explicitly states sponsorship is offered" : selectedJob.sponsor_verified ? "Employer appears on the register; this vacancy does not confirm sponsorship" : "Employer was not matched to the cached register"}<br>
            <b>Candidate Work Status:</b> ${activeProfile?.visaSponsorshipRequired ? "Candidate profile records a Skilled Worker sponsorship requirement." : "Candidate profile records no sponsorship requirement."}<br>
            <b>Application Advice:</b> ${selectedJob.sponsorship_status === "offered" && selectedJob.sponsor_verified ? "Confirm eligibility, occupation code, salary threshold and sponsorship terms with the employer." : selectedJob.sponsor_verified ? "Ask the recruiter whether this specific role can issue a Certificate of Sponsorship." : "Check the vacancy and current GOV.UK sponsor register before submission."}
          </div>
        </div>
      </div>

      <!-- Full Job Description Viewer & In-Place Editor -->
      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h3 style="font-size: 14.5px; display: flex; align-items: center; gap: 8px; margin: 0;">
            <span>📄 Full Job Description</span>
            <span style="font-size: 11px; font-weight: normal; color: var(--text-tertiary);">(${jdText.length} characters)</span>
          </h3>
          <div style="display: flex; gap: 8px;">
            ${jdText.length < 200 ? '<button class="btn-primary" id="btnHydrateJD" style="font-size: 11px; padding: 4px 10px;">🔄 Auto-Fetch Complete JD</button>' : ''}
            <button class="btn-secondary" id="btnToggleEditJD" style="font-size: 11px; padding: 4px 10px;">✏️ Edit / Paste Complete JD</button>
            <button class="btn-secondary" id="btnCopyJD" style="font-size: 11px; padding: 4px 10px;">📋 Copy JD</button>
          </div>
        </div>

        <div id="jdViewContainer">
          <div style="background: #0f1217; border: 1px solid var(--border-subtle); border-radius: 6px; padding: 16px; font-size: 12.5px; color: #e2e8f0; line-height: 1.65; white-space: pre-wrap; max-height: 380px; overflow-y: auto;">${escapeHtml(jdText)}</div>
        </div>

        <div id="jdEditContainer" style="display: none; margin-top: 10px;">
          <textarea id="jdEditTextarea" rows="14" style="width: 100%; background: #0f1217; border: 1px solid var(--apple-blue); border-radius: 6px; padding: 12px; font-size: 12px; color: #f8fafc; font-family: var(--font-mono); resize: vertical; box-sizing: border-box;">${escapeHtml(jdText)}</textarea>
          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
            <button class="btn-secondary" id="btnCancelEditJD" style="font-size: 11.5px; padding: 5px 12px;">Cancel</button>
            <button class="btn-primary" id="btnSaveEditJD" style="font-size: 11.5px; padding: 5px 12px;">💾 Save Complete JD</button>
          </div>
        </div>
      </div>

      <!-- Logistics & Commute Details -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 16px;">
          <h4 style="font-size: 13px; margin-bottom: 8px; color: #fff;">📍 Location & Commute Matrix</h4>
          <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.6; margin: 0;">
            <b>Job Location:</b> ${escapeHtml(selectedJob.location)}<br>
            <b>Candidate Base:</b> ${escapeHtml(activeProfile?.location || "")}${activeProfile?.postcode ? ` (${activeProfile.postcode})` : ''}<br>
            <b>Commute Distance:</b> ~${selectedJob.distance_miles} mi (${escapeHtml(selectedJob.commute_tag)})<br>
            <b>Candidate Max Radius:</b> ${activeProfile?.preferredRadiusMiles || 50} miles
          </p>
        </div>
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 16px;">
          <h4 style="font-size: 13px; margin-bottom: 8px; color: #fff;">💰 Compensation & Portal</h4>
          <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.6; margin: 0;">
            <b>Advertised Compensation:</b> ${escapeHtml(selectedJob.salary)}<br>
            <b>Candidate Target:</b> ≥£${(activeProfile?.minSalary || 75000).toLocaleString()}<br>
            <b>Job Sourcing Portal:</b> ${escapeHtml(selectedJob.portal)}<br>
            <b>Current Application Status:</b> <span class="status-badge ${selectedJob.status}">${selectedJob.status.toUpperCase()}</span>
          </p>
        </div>
      </div>
    </div>
  `;

  // Hook up Auto-Fetch Full JD
  document.getElementById("btnHydrateJD")?.addEventListener("click", async () => {
    const btn = document.getElementById("btnHydrateJD");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "⏳ Fetching...";
    }
    try {
      const res = await fetch("/api/jobs/hydrate-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJob.id })
      });
      const data = await res.json();
      if (data.success && data.fullJd) {
        selectedJob.full_jd = data.fullJd;
        if (data.analysis) {
          selectedJob.analysis = data.analysis;
          selectedJob.fit_score = data.analysis.overallScore;
        }
        showToast("✨ Complete Job Description fetched from portal!");
        renderDetailsTab();
      } else {
        showToast(data.error || "Could not fetch full JD. You can paste it below.");
        if (btn) {
          btn.disabled = false;
          btn.textContent = "🔄 Retry Auto-Fetch";
        }
      }
    } catch {
      showToast("Error connecting to server.");
    }
  });

  // Hook up JD copy
  document.getElementById("btnCopyJD")?.addEventListener("click", () => {
    navigator.clipboard.writeText(jdText);
    showToast("Full Job Description copied to clipboard!");
  });

  // Hook up Edit/Paste Full JD toggle
  const btnToggle = document.getElementById("btnToggleEditJD");
  const viewCont = document.getElementById("jdViewContainer");
  const editCont = document.getElementById("jdEditContainer");
  const btnCancel = document.getElementById("btnCancelEditJD");
  const btnSave = document.getElementById("btnSaveEditJD");
  const editTextarea = document.getElementById("jdEditTextarea");

  btnToggle?.addEventListener("click", () => {
    viewCont.style.display = "none";
    editCont.style.display = "block";
    editTextarea.focus();
  });

  btnCancel?.addEventListener("click", () => {
    editCont.style.display = "none";
    viewCont.style.display = "block";
  });

  btnSave?.addEventListener("click", async () => {
    const updated = editTextarea.value.trim();
    if (!updated) {
      showToast("Job description cannot be empty.");
      return;
    }
    btnSave.disabled = true;
    btnSave.textContent = "Saving...";

    try {
      const res = await fetch("/api/jobs/update-jd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: selectedJob.id, fullJd: updated })
      });
      const data = await res.json();
      if (data.success) {
        selectedJob.full_jd = updated;
        showToast("✨ Complete Job Description updated!");
        renderDetailsTab();
      } else {
        showToast(data.error || "Failed to update JD");
      }
    } catch {
      showToast("Error updating job description.");
    }
  });
}

function renderAnswersTab() {
  const visaText = activeProfile?.visaSponsorshipRequired ?
    `Yes. My candidate profile records that I require Skilled Worker sponsorship. I would confirm the exact arrangement with ${selectedJob.company}.` :
    "No, I have unrestricted right to work in the UK and do not require sponsorship.";
  const unverifiedAnswer = "Not recorded in the candidate profile. Confirm this before submitting.";
  const locationAnswer = `The role is listed in ${selectedJob.location || "an unspecified location"}. Confirm the required schedule and commute before submitting.`;

  studioContent.innerHTML = `
    <div style="max-width: 820px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px;">
      <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 16px;">
        <h4 style="font-size: 14px; color: var(--apple-blue); margin-bottom: 6px;">Do you require visa sponsorship to work in the UK?</h4>
        <p style="font-size: 13px; color: var(--text-primary); margin-bottom: 8px;"><b>${activeProfile?.visaSponsorshipRequired ? 'Yes' : 'No'}</b></p>
        <div style="font-size: 12px; color: var(--text-secondary); background: rgba(0,0,0,0.25); padding: 8px; border-radius: 6px;">
          "${escapeHtml(visaText)}"
        </div>
      </div>

      <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 16px;">
        <h4 style="font-size: 14px; color: var(--apple-blue); margin-bottom: 6px;">What is your notice period?</h4>
        <div style="font-size: 12px; color: var(--text-secondary); background: rgba(0,0,0,0.25); padding: 8px; border-radius: 6px;">
          "${unverifiedAnswer}"
        </div>
      </div>

      <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 16px;">
        <h4 style="font-size: 14px; color: var(--apple-blue); margin-bottom: 6px;">Are you willing to work in a hybrid schedule in ${selectedJob.location}?</h4>
        <div style="font-size: 12px; color: var(--text-secondary); background: rgba(0,0,0,0.25); padding: 8px; border-radius: 6px;">
          "${escapeHtml(locationAnswer)}"
        </div>
      </div>
    </div>
  `;
}

async function tailorCurrentJob() {
  if (!selectedJob) return;

  btnTailor.disabled = true;
  btnTailor.textContent = "⏳ Tailoring...";

  try {
    const res = await fetch("/api/tailor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: selectedJob.id,
        company: selectedJob.company,
        role: selectedJob.title,
        location: selectedJob.location,
        fullJd: selectedJob.full_jd || selectedJob.summary || "",
        keySkills: selectedJob.key_skills || [],
        force: true
      })
    });

    const data = await res.json();
    if (data.success) {
      selectedJob.status = "drafted";
      selectedJob.cv_file = data.cvPath;
      selectedJob.cover_file = data.coverPath;
      if (data.analysis) {
        selectedJob.analysis = data.analysis;
        selectedJob.fit_score = data.analysis.overallScore;
      }
      activeTailoredData = data;
      renderJobs();
      renderStudioTabContent();
      showToast(`✨ Tailored ATS CV & Cover Letter generated for ${selectedJob.company}!`);
    } else {
      showToast(data.error || "Failed to tailor application");
    }
  } catch (err) {
    console.error(err);
    showToast("Error during tailoring");
  } finally {
    btnTailor.disabled = false;
    btnTailor.textContent = "⚡ Tailor CV & Cover Letter";
  }
}

async function downloadPDF(type) {
  if (!selectedJob) return;

  const docPath = type === "cover" ? selectedJob.cover_file : selectedJob.cv_file;
  if (!docPath) {
    showToast("Please tailor the application first to generate LaTeX.");
    return;
  }

  showToast("Preparing document export...");

  try {
    const docRes = await fetch(`/api/document?path=${encodeURIComponent(docPath)}`);
    const docData = await docRes.json();
    if (!docData.content) {
      showToast("Could not read LaTeX source file");
      return;
    }

    const candidateSlug = (activeProfile?.name || "candidate").replace(/[^a-zA-Z0-9]/g, "_");
    const cleanCompany = (selectedJob.company || "company").replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `${candidateSlug}_${cleanCompany}_${type.toUpperCase()}.pdf`;

    const compileRes = await fetch("/api/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latexCode: docData.content, filename, kind: type })
    });

    const result = await compileRes.json();
    if (result.success && result.repoPath) {
      // 1. Copy PDF directly to the user's Downloads directory.
      try {
        const saveRes = await fetch("/api/save-to-downloads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: result.repoPath, filename: result.filename, open: false })
        });
        const saveData = await saveRes.json();
        if (saveData.success) {
          showToast(`PDF saved to Downloads: ${result.filename}`);
        }
      } catch (saveErr) {
        console.warn("Could not copy to ~/Downloads:", saveErr);
      }

      // 2. Open PDF in the system viewer without navigating the app webview.
      fetch("/api/open-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: result.repoPath })
      }).catch(() => {});

      showToast(`ATS PDF compiled and opened: ${result.filename}`);
    } else {
      console.error("Compilation error:", result);
      showToast(`PDF compilation failed: ${result.error || "Check LaTeX syntax"}`);
      // Fallback: save .tex source directly
      try {
        await fetch("/api/save-to-downloads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: docPath, filename: filename.replace(/\.pdf$/i, ".tex"), open: false })
        });
        showToast(`Saved LaTeX source to Downloads: ${filename.replace(/\.pdf$/i, ".tex")}`);
      } catch {}
    }
  } catch (err) {
    console.error("Download PDF error:", err);
    showToast(`⚠️ Document export error: ${err.message || err}`);
  }
}

async function openInPreview(type) {
  if (!selectedJob) return;
  const docPath = type === "cover" ? selectedJob.cover_file : selectedJob.cv_file;
  if (!docPath) {
    showToast("Please tailor the application first to generate the document.");
    return;
  }
  const candidateSlug = (activeProfile?.name || "candidate").replace(/[^a-zA-Z0-9]/g, "_");
  const cleanCompany = (selectedJob.company || "company").replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `${candidateSlug}_${cleanCompany}_${type.toUpperCase()}.pdf`;
  const folder = type === "cover" ? "cover_letters" : "cv";
  const pdfPath = `${folder}/${filename}`;

  try {
    const res = await fetch("/api/open-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pdfPath })
    });
    const data = await res.json();
    if (data.success) {
      showToast("Opened with the system PDF viewer");
    } else {
      // PDF hasn't been compiled yet: compile it now and open!
      await downloadPDF(type);
    }
  } catch {
    await downloadPDF(type);
  }
}

async function revealInFinder(type) {
  if (!selectedJob) return;
  const docPath = type === "cover" ? selectedJob.cover_file : selectedJob.cv_file;
  if (!docPath) {
    showToast("Please tailor the application first.");
    return;
  }
  const candidateSlug = (activeProfile?.name || "candidate").replace(/[^a-zA-Z0-9]/g, "_");
  const cleanCompany = (selectedJob.company || "company").replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `${candidateSlug}_${cleanCompany}_${type.toUpperCase()}.pdf`;
  const folder = type === "cover" ? "cover_letters" : "cv";
  const pdfPath = `${folder}/${filename}`;

  try {
    const res = await fetch("/api/reveal-file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pdfPath })
    });
    const data = await res.json();
    if (data.success) {
      showToast("Shown in the system file browser");
    } else {
      await fetch("/api/reveal-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: docPath })
      });
      showToast("Shown in the system file browser");
    }
  } catch {
    showToast("Could not show the file in its folder");
  }
}

async function markCurrentJobApplied() {
  if (!selectedJob) return;

  try {
    const res = await fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: selectedJob.id,
        company: selectedJob.company,
        role: selectedJob.title,
        status: "applied",
        url: selectedJob.url || ""
      })
    });

    const data = await res.json();
    if (data.success) {
      selectedJob.status = "applied";
      allJobs.forEach(j => {
        if (j.id === selectedJob.id || (j.company === selectedJob.company && j.title === selectedJob.title)) {
          j.status = "applied";
        }
      });
      btnMarkApplied.textContent = "✅ Applied";
      btnMarkApplied.disabled = true;
      renderJobs();
      updateBadgeCounts();
      showToast(`Marked as applied in job_search_tracker.csv!`);
    }
  } catch (err) {
    showToast("Error updating application status");
  }
}

function copyOutreachMessage() {
  if (!selectedJob) return;
  const name = activeProfile?.name || "Candidate";
  const headline = activeProfile?.headline || "Software Engineer";
  const loc = activeProfile?.location || "UK";

  const msg = `Hi there,\n\nI noticed ${selectedJob.company} is hiring for a ${selectedJob.title} in ${selectedJob.location}. I'm a ${headline} based in ${loc}.\n\nI'd love to connect and discuss how my background can support your engineering team!\n\nBest regards,\n${name}`;
  navigator.clipboard.writeText(msg);
  showToast("Outreach message copied!");
}

function renderSponsorRegistryStatus(status = {}) {
  if (!sponsorRegistryStatus) return;
  const fetched = status.fetchedAt ? new Date(status.fetchedAt).toLocaleString() : "not downloaded yet";
  sponsorRegistryStatus.textContent = `${Number(status.count || 0).toLocaleString()} register rows · updated ${fetched}`;
}

function renderSourceStatus(search) {
  if (!sourceRunStatus || !search) return;
  const reports = search.sources || [];
  const completed = search.completedAt ? new Date(search.completedAt).toLocaleString() : "just now";
  const totalFound = reports.reduce((sum, source) => sum + Number(source.found || 0), 0);
  sourceRunStatus.innerHTML = `
    <b>Last search · ${escapeHtml(completed)}</b>
    <div>${totalFound} returned · ${Number(search.addedCount || 0)} new · ${Number(search.enrichedCount || 0)} enriched · ${Number(search.filteredCount || 0)} sponsorship-filtered</div>
    ${reports.map(source => `
      <div class="source-report-row ${source.status}">
        <span>${escapeHtml(source.source)}</span>
        <span>${escapeHtml(source.status)} · ${Number(source.found || 0)} found · ${Number(source.added || 0)} new</span>
        ${(source.reason || source.guidance) ? `<span class="source-report-detail">${escapeHtml([source.reason, source.guidance].filter(Boolean).join(" "))}</span>` : ""}
      </div>`).join("")}
    ${search.sponsorRegistry?.error ? `<div class="source-report-row failed"><span>Sponsor register</span><span>cached/offline</span><span class="source-report-detail">${escapeHtml(search.sponsorRegistry.error)} Refresh the register from Sources when the internet connection is available.</span></div>` : ""}
  `;
}

async function fetchDiagnostics() {
  try {
    const res = await fetch("/api/diagnostics");
    const data = await res.json();
    const issues = data.runtime?.issues || [];
    if (runtimeIssues) {
      runtimeIssues.style.display = issues.length ? "block" : "none";
      runtimeIssues.innerHTML = issues.length
        ? `<b>Installation needs attention</b>${issues.map(issue => `<div>${escapeHtml(issue.message)} ${escapeHtml(issue.guidance)}</div>`).join("")}`
        : "";
    }
    if (data.lastSearch) renderSourceStatus(data.lastSearch);
  } catch {
    if (runtimeIssues) {
      runtimeIssues.style.display = "block";
      runtimeIssues.textContent = "Diagnostics could not be loaded. Reload the app; if this continues, restart it and check the local server log.";
    }
  }
}

async function fetchSearchConfig() {
  try {
    const res = await fetch("/api/search/config");
    const data = await res.json();
    searchConfig = data.config;
    const sources = searchConfig.sources || {};
    document.getElementById("sourceLinkedin").checked = Boolean(sources.linkedin);
    document.getElementById("sourceFreehire").checked = Boolean(sources.freehire);
    document.getElementById("sourceCvLibrary").checked = Boolean(sources.cvLibrary);
    document.getElementById("sourceReed").checked = Boolean(sources.reed);
    document.getElementById("sourceGoogleJobs").checked = Boolean(sources.googleJobs);
    document.getElementById("sourceAdzuna").checked = Boolean(sources.adzuna);
    document.getElementById("sourceJobicy").checked = Boolean(sources.jobicy);
    document.getElementById("sourceArbeitnow").checked = Boolean(sources.arbeitnow);
    document.getElementById("sourceRemotive").checked = Boolean(sources.remotive);
    document.getElementById("sponsorshipMode").value = searchConfig.sponsorshipMode || "all";

    const updateKeyIndicator = (statusId, inputId, isConfigured, name) => {
      const statusEl = document.getElementById(statusId);
      const inputEl = document.getElementById(inputId);
      if (statusEl) {
        statusEl.textContent = isConfigured ? "✓ Saved" : "Optional";
        statusEl.className = "source-key-status " + (isConfigured ? "saved" : "missing");
      }
      if (inputEl) {
        inputEl.placeholder = isConfigured ? "✓ Configured · leave blank to keep" : `Enter ${name}`;
      }
    };

    updateKeyIndicator("cvLibraryKeyStatus", "cvLibraryApiKey", Boolean(searchConfig.hasCvLibraryKey), "CV-Library API key");
    updateKeyIndicator("reedKeyStatus", "reedApiKey", Boolean(searchConfig.hasReedKey), "Reed API key");
    updateKeyIndicator("serpKeyStatus", "serpApiKey", Boolean(searchConfig.hasSerpApiKey), "SerpAPI key");
    updateKeyIndicator("adzunaIdStatus", "adzunaAppId", Boolean(searchConfig.hasAdzunaCredentials), "Adzuna App ID");
    updateKeyIndicator("adzunaKeyStatus", "adzunaAppKey", Boolean(searchConfig.hasAdzunaCredentials), "Adzuna App Key");

    renderSponsorRegistryStatus(data.sponsorRegistry);
  } catch {
    searchConfig = { sponsorshipMode: "all", sources: { linkedin: true, freehire: true, jobicy: true, arbeitnow: false, remotive: true } };
  }
}

async function saveSearchConfig() {
  const payload = {
    sources: {
      linkedin: true,
      freehire: true,
      cvLibrary: document.getElementById("sourceCvLibrary").checked,
      reed: document.getElementById("sourceReed").checked,
      googleJobs: document.getElementById("sourceGoogleJobs").checked,
      adzuna: document.getElementById("sourceAdzuna").checked,
      jobicy: document.getElementById("sourceJobicy").checked,
      arbeitnow: document.getElementById("sourceArbeitnow").checked,
      remotive: document.getElementById("sourceRemotive").checked,
    },
    sponsorshipMode: document.getElementById("sponsorshipMode").value,
    cvLibraryApiKey: document.getElementById("cvLibraryApiKey").value,
    reedApiKey: document.getElementById("reedApiKey").value,
    serpApiKey: document.getElementById("serpApiKey").value,
    adzunaAppId: document.getElementById("adzunaAppId").value,
    adzunaAppKey: document.getElementById("adzunaAppKey").value,
  };
  const res = await fetch("/api/search/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await res.json();
  if (!data.success) return showToast(data.error || "Could not save search settings");
  searchConfig = data.config;
  ["cvLibraryApiKey", "reedApiKey", "serpApiKey", "adzunaAppId", "adzunaAppKey"].forEach(id => document.getElementById(id).value = "");
  await fetchSearchConfig();
  searchConfigModal.style.display = "none";
  showToast("Search sources saved");
}

async function refreshSponsorRegister() {
  btnRefreshSponsors.disabled = true;
  try {
    const res = await fetch("/api/sponsors/refresh", { method: "POST" });
    const data = await res.json();
    renderSponsorRegistryStatus(data);
    showToast(data.success ? `Verified ${Number(data.count || 0).toLocaleString()} sponsor rows` : (data.error || "Register refresh failed"));
    if (data.success) await fetchJobs();
  } finally {
    btnRefreshSponsors.disabled = false;
  }
}

async function openScheduleModal() {
  if (activeProfile) {
    scheduleCandidateSubtitle.textContent = `${activeProfile.name || "Candidate"} · ${activeProfile.headline || "Profile Track"}`;
  } else {
    scheduleCandidateSubtitle.textContent = "Candidate Profile";
  }

  // Reset unchecked apply to all
  schedApplyToAll.checked = false;

  try {
    const profileId = activeProfile ? activeProfile.id : "";
    const res = await fetch(`/api/schedule?profileId=${encodeURIComponent(profileId)}`);
    const data = await res.json();
    const sched = data.activeProfileSchedule || activeProfile?.schedule;

    const isEnabled = Boolean(sched?.enabled);
    schedEnabledToggle.checked = isEnabled;
    scheduleOptionsContainer.style.opacity = isEnabled ? "1" : "0.5";
    scheduleOptionsContainer.style.pointerEvents = isEnabled ? "auto" : "none";

    const mode = sched?.mode || "interval";
    const radio = document.querySelector(`input[name="schedMode"][value="${mode}"]`);
    if (radio) radio.checked = true;

    if (mode === "daily") {
      schedIntervalSection.style.display = "none";
      schedDailySection.style.display = "block";
    } else {
      schedIntervalSection.style.display = "block";
      schedDailySection.style.display = "none";
    }

    schedIntervalSelect.value = String(sched?.intervalHours || 4);
    schedDailyTimeInput.value = sched?.dailyTime || "08:00";

    // Status card
    if (sched?.isRunningNow) {
      schedStatusBadge.textContent = "Searching Now...";
      schedStatusBadge.className = "schedule-status-pill running";
    } else if (isEnabled) {
      schedStatusBadge.textContent = "Active";
      schedStatusBadge.className = "schedule-status-pill";
    } else {
      schedStatusBadge.textContent = "Paused";
      schedStatusBadge.className = "schedule-status-pill paused";
    }

    schedCountdownText.textContent = isEnabled
      ? (sched?.countdown ? `Next run: ${sched.countdown}` : "Next run: calculating...")
      : "Schedule paused";

    if (sched?.lastRunAt) {
      const dt = new Date(sched.lastRunAt);
      schedLastRunText.textContent = dt.toLocaleString(undefined, {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
      });
    } else {
      schedLastRunText.textContent = "Never run yet";
    }

    if (sched?.lastRunResult) {
      schedResultRow.style.display = "flex";
      const resMsg = sched.lastRunResult.status === "error"
        ? `Error: ${sched.lastRunResult.message || "Scrape failed"}`
        : `${sched.lastRunResult.foundCount} jobs found (${sched.lastRunResult.addedCount} newly added)`;
      schedLastResultText.textContent = resMsg;
      schedLastResultText.style.color = sched.lastRunResult.status === "error" ? "var(--apple-red)" : "var(--apple-green)";
    } else {
      schedResultRow.style.display = "none";
    }
  } catch (err) {
    console.error("Failed to load schedule status:", err);
  }

  scheduleModal.style.display = "flex";
}

let activeSaveScheduleAbortController = null;
let activeTestRunScheduleAbortController = null;

function closeScheduleModal() {
  if (activeSaveScheduleAbortController) {
    try { activeSaveScheduleAbortController.abort(); } catch {}
    activeSaveScheduleAbortController = null;
  }
  if (activeTestRunScheduleAbortController) {
    try { activeTestRunScheduleAbortController.abort(); } catch {}
    activeTestRunScheduleAbortController = null;
  }
  btnSaveSchedule.disabled = false;
  btnSaveSchedule.textContent = "💾 Save Schedule";
  testRunSpinner.style.display = "none";
  testRunLabel.textContent = "⚡ Run Scraper Now (Test)";
  btnTestRunSchedule.disabled = false;
  scheduleModal.style.display = "none";
}

async function saveSchedule() {
  const enabled = schedEnabledToggle.checked;
  const modeRadio = document.querySelector('input[name="schedMode"]:checked');
  const mode = modeRadio ? modeRadio.value : "interval";
  const intervalHours = Number(schedIntervalSelect.value) || 4;
  const dailyTime = schedDailyTimeInput.value || "08:00";
  const applyToAll = schedApplyToAll.checked;

  btnSaveSchedule.disabled = true;
  btnSaveSchedule.textContent = "Saving...";

  if (activeSaveScheduleAbortController) {
    try { activeSaveScheduleAbortController.abort(); } catch {}
  }
  activeSaveScheduleAbortController = new AbortController();
  const timeoutId = setTimeout(() => {
    if (activeSaveScheduleAbortController) activeSaveScheduleAbortController.abort();
  }, 10000);

  try {
    const res = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: activeProfile ? activeProfile.id : undefined,
        enabled,
        mode,
        intervalHours,
        dailyTime,
        applyToAll
      }),
      signal: activeSaveScheduleAbortController.signal
    });
    clearTimeout(timeoutId);
    activeSaveScheduleAbortController = null;
    const data = await res.json();
    if (!data.success) {
      showToast(data.error || "Failed to save schedule");
      return;
    }

    if (activeProfile) {
      activeProfile.schedule = data.schedule;
    }

    scheduleModal.style.display = "none";
    showToast(applyToAll
      ? "⏰ Automated schedule saved and synchronized across ALL profiles!"
      : "⏰ Automated schedule saved for current candidate profile!"
    );
  } catch (err) {
    clearTimeout(timeoutId);
    activeSaveScheduleAbortController = null;
    if (err && err.name === "AbortError") {
      showToast("Schedule save timed out or was cancelled");
    } else {
      showToast("Failed to communicate with scheduler service");
    }
  } finally {
    btnSaveSchedule.disabled = false;
    btnSaveSchedule.textContent = "💾 Save Schedule";
  }
}

async function runScheduleTestNow() {
  testRunSpinner.style.display = "inline-block";
  testRunLabel.textContent = "Searching Live...";
  btnTestRunSchedule.disabled = true;

  if (activeTestRunScheduleAbortController) {
    try { activeTestRunScheduleAbortController.abort(); } catch {}
  }
  activeTestRunScheduleAbortController = new AbortController();
  const timeoutId = setTimeout(() => {
    if (activeTestRunScheduleAbortController) activeTestRunScheduleAbortController.abort();
  }, 35000);

  try {
    const res = await fetch("/api/schedule/run-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: activeProfile ? activeProfile.id : undefined
      }),
      signal: activeTestRunScheduleAbortController.signal
    });
    clearTimeout(timeoutId);
    activeTestRunScheduleAbortController = null;
    const data = await res.json();
    if (data.success) {
      showToast(`⚡ Search complete: ${data.foundCount} roles found (${data.addedCount} newly added)`);
      await fetchJobs();
      // Re-populate modal status
      schedLastRunText.textContent = "Just now";
      schedResultRow.style.display = "flex";
      schedLastResultText.textContent = `${data.foundCount} jobs found (${data.addedCount} newly added)`;
      schedLastResultText.style.color = "var(--apple-green)";
      schedCountdownText.textContent = "Next run updated";
    } else {
      showToast(`Search test failed: ${data.error || "Unknown error"}`);
    }
  } catch (err) {
    clearTimeout(timeoutId);
    activeTestRunScheduleAbortController = null;
    if (err && err.name === "AbortError") {
      showToast("Live search test timed out or was cancelled");
    } else {
      showToast("Test search network request failed");
    }
  } finally {
    testRunSpinner.style.display = "none";
    testRunLabel.textContent = "⚡ Run Scraper Now (Test)";
    btnTestRunSchedule.disabled = false;
  }
}

async function triggerScrape(request = {}) {
  scrapeSpinner.style.display = "inline-block";
  scrapeLabel.textContent = "Searching Live...";
  btnScrape.disabled = true;

  try {
    const res = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...request, sponsorshipMode: request.sponsorshipMode || searchConfig?.sponsorshipMode || "all" }),
    });
    const data = await res.json();
    if (data.success) {
      renderSourceStatus(data);
      const totalFound = (data.sources || []).reduce((sum, source) => sum + Number(source.found || 0), 0);
      const failedSources = (data.sources || []).filter(source => source.status === "failed").map(source => source.source);
      const outcome = data.addedCount > 0
        ? `${data.addedCount} new jobs added from ${totalFound} returned`
        : totalFound > 0
          ? `${totalFound} jobs returned; 0 were new (already saved or filtered)`
          : "No jobs were returned";
      showToast(`${outcome}${failedSources.length ? ` · Failed: ${failedSources.join(", ")}. Open Sources for fixes.` : ""}`);
      if (data.sponsorshipMode === "licensed") currentFilter = "sponsor_verified";
      if (data.sponsorshipMode === "explicit") currentFilter = "sponsorship_explicit";
      await fetchJobs();
    } else {
      showToast(data.error || "Search failed. Open Sources for diagnostics.");
    }
  } catch (err) {
    showToast(`Search could not reach the local server: ${err.message || err}. Restart the app.`);
  } finally {
    scrapeSpinner.style.display = "none";
    scrapeLabel.textContent = "⚡ Run Daily Scrape";
    btnScrape.disabled = false;
  }
}

function showToast(message) {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = "toast";
  const status = document.createElement("span");
  status.className = "toast-status";
  status.setAttribute("aria-hidden", "true");
  const copy = document.createElement("span");
  copy.textContent = String(message || "Done");
  toast.append(status, copy);
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function escapeHtml(text) {
  if (!text) return "";
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.toString().replace(/[&<>"']/g, m => map[m]);
}

function cleanCandidateHeadline(role, fallback = "Professional Candidate") {
  if (!role) return fallback;
  let clean = role.split(/—|-|\|/)[0].trim();
  clean = clean.replace(/\(.*?\)/g, "").trim();
  const lower = clean.toLowerCase();
  if (lower.includes("devops") && lower.includes("lead")) return "Lead DevOps Engineer";
  if (lower.includes("platform") && lower.includes("lead")) return "Lead Platform Engineer";
  if (lower.includes("platform") && lower.includes("senior")) return "Senior Platform Engineer";
  if (lower.includes("devops") && lower.includes("senior")) return "Senior DevOps Engineer";
  if (lower.includes("sre") || lower.includes("site reliability")) return "Senior Site Reliability Engineer";
  if (lower.includes("cloud")) return "Senior Cloud Infrastructure Engineer";
  return clean || fallback;
}

function parseLatexCV(latex) {
  const result = { summary: "", experience: [], skillsHtml: "", projects: [] };
  if (!latex) return result;

  try {
    // 1. Summary: support \section{Summary} or \section{Professional Summary}
    const summaryMatch = latex.match(/\\section\{(?:Professional\s+)?Summary\}[\s\S]*?\\small\{([\s\S]*?)\}/i) ||
                         latex.match(/\\section\{(?:Professional\s+)?Summary\}([\s\S]*?)(?:\\section|$)/i);
    if (summaryMatch) {
      result.summary = summaryMatch[1]
        .replace(/\\small\{/g, "")
        .replace(/\}/g, "")
        .replace(/\\&/g, "&")
        .replace(/\\%/g, "%")
        .replace(/\\_/g, "_")
        .trim();
    }

    // 2. Experience: support \section{Work Experience} or \section{Professional Experience}
    const expSection = latex.match(/\\section\{(?:Professional\s+Experience|Work\s+Experience)\}[\s\S]*?\\resumeSubHeadingListStart([\s\S]*?)\\resumeSubHeadingListEnd/i);
    if (expSection) {
      const expBlocks = expSection[1].split(/\\resumeSubheading/g).filter(b => b.trim().length > 0);
      expBlocks.forEach(block => {
        let company = "", location = "", title = "", dates = "";
        const m = block.match(/\{([^}]*)\}\{([^}]*)\}\s*\{([^}]*)\}\{([^}]*)\}/);
        if (m) {
          company = m[1].replace(/\\&/g, "&");
          location = m[2].replace(/\\&/g, "&");
          title = m[3].replace(/\\&/g, "&");
          dates = m[4].replace(/\\&/g, "&").replace(/--/g, "–");
        }
        const bulletMatches = block.match(/\\resumeItem\{([\s\S]*?)\}/g) || [];
        const items = bulletMatches.map(b => {
          return b.replace(/\\resumeItem\{/, "").replace(/\}$/, "")
                  .replace(/\\&/g, "&").replace(/\\%/g, "%").replace(/\\#/g, "#").replace(/\\_/g, "_")
                  .replace(/\\textbf\{([^}]*)\}/g, "$1")
                  .trim();
        });
        if (company) result.experience.push({ company, location, title, dates, items });
      });
    }

    // 3. Technical Projects: support \section{Technical Projects} or \section{Projects}
    const projSection = latex.match(/\\section\{(?:Technical\s+)?Projects\}[\s\S]*?\\resumeSubHeadingListStart([\s\S]*?)\\resumeSubHeadingListEnd/i);
    if (projSection) {
      const projBlocks = projSection[1].split(/\\resumeProjectHeading/g).filter(b => b.trim().length > 0);
      projBlocks.forEach(block => {
        let name = "", tools = "", category = "";
        const m = block.match(/\{\\textbf\{([^}]*)\}\s*\$?\|\$?\s*\\emph\{([^}]*)\}\}\s*\{([^}]*)\}/);
        if (m) {
          name = m[1].replace(/\\&/g, "&");
          tools = m[2].replace(/\\&/g, "&");
          category = m[3].replace(/\\&/g, "&");
        } else {
          const simple = block.match(/\{([^}]*)\}\s*\{([^}]*)\}/);
          if (simple) {
            name = simple[1].replace(/\\&/g, "&");
            category = simple[2].replace(/\\&/g, "&");
          }
        }
        const bulletMatches = block.match(/\\resumeItem\{([\s\S]*?)\}/g) || [];
        const items = bulletMatches.map(b => {
          return b.replace(/\\resumeItem\{/, "").replace(/\}$/, "")
                  .replace(/\\&/g, "&").replace(/\\%/g, "%").replace(/\\#/g, "#").replace(/\\_/g, "_")
                  .replace(/\\textbf\{([^}]*)\}/g, "$1")
                  .trim();
        });
        if (name) result.projects.push({ name, tools, category, items });
      });
    }

    // 4. Skills: support \section{Technical Skills}
    const skillsMatch = latex.match(/\\section\{Technical Skills\}[\s\S]*?\\begin\{itemize\}[\s\S]*?\\small\{\\item\{([\s\S]*?)\}\}\s*\\end\{itemize\}/i);
    if (skillsMatch) {
      result.skillsHtml = skillsMatch[1]
        .replace(/\\textbf\{([^}]*)\}/g, "$1")
        .replace(/\\\\/g, "\n")
        .replace(/\\&/g, "&")
        .replace(/\\_/g, "_")
        .trim();
    }
  } catch (err) {
    console.error("LaTeX parse error:", err);
  }
  return result;
}
