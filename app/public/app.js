// AI Job Search Studio — Frontend App Logic
// Multi-Profile Management, In-App AI Provider, & Scenario Prompting

let allJobs = [];
let selectedJob = null;
let currentFilter = "all";
let currentTab = "tab-cv";
let activeTailoredData = null;
let currentSortMode = "days";

// Multi-Profile State
let allProfiles = [];
let activeProfile = null;
let selectedResumeFile = null;

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

// Initialize
document.addEventListener("DOMContentLoaded", async () => {
  await fetchProfiles();
  await fetchAiConfig();
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
    importResumeModal.style.display = "flex";
  });
  document.getElementById("btnSidebarUploadResume")?.addEventListener("click", () => {
    rawResumeInput.value = "";
    importResumeModal.style.display = "flex";
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
    if (fileInput) fileInput.value = "";
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
    item.innerHTML = `
      <div>
        <div style="font-weight: 600;">${escapeHtml(p.name)}</div>
        <div style="font-size: 11px; opacity: 0.8;">${escapeHtml(p.headline)}</div>
      </div>
      ${p.id === activeProfile?.id ? '<span>✓</span>' : ''}
    `;
    item.addEventListener("click", () => switchActiveProfile(p.id));
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

function openProfileModal(profileToEdit) {
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

    const allSkills = [
      ...(profileToEdit.skills?.cloud || []),
      ...(profileToEdit.skills?.devops || []),
      ...(profileToEdit.skills?.languages || []),
      ...(profileToEdit.skills?.tools || [])
    ];
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

  const existing = allProfiles.find(p => p.id === id);

  const profilePayload = {
    id: id || name.toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now().toString().slice(-4),
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
    skills: existing?.skills || {
      cloud: rawSkills.slice(0, 4),
      devops: rawSkills.slice(4, 10),
      languages: ["Python", "TypeScript", "Bash"],
      tools: rawSkills.slice(10)
    },
    experience: existing?.experience || [
      {
        company: "Tech Enterprise",
        role: headline,
        location: `${location} / Hybrid`,
        startDate: "2023",
        endDate: "Present",
        bullets: [
          `Engineered and scaled cloud platforms and infrastructure as a ${headline}.`,
          "Automated release cycles and container deployment workflows."
        ]
      }
    ],
    education: existing?.education || [],
    certifications: existing?.certifications || []
  };

  try {
    const res = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profilePayload)
    });
    const data = await res.json();
    if (data.success) {
      profileModal.style.display = "none";
      showToast(`Saved profile for ${name}`);
      await fetchProfiles();
      await switchActiveProfile(data.profile.id);
    }
  } catch (err) {
    showToast("Error saving profile");
  }
}

async function deleteCurrentProfile() {
  if (!activeProfile) return;
  if (allProfiles.length <= 1) {
    showToast("Cannot delete the only profile");
    return;
  }
  if (!confirm(`Are you sure you want to delete profile: ${activeProfile.name}?`)) return;

  try {
    const res = await fetch("/api/profiles", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activeProfile.id })
    });
    const data = await res.json();
    if (data.success) {
      showToast("Profile deleted");
      await fetchProfiles();
      await fetchJobs();
    }
  } catch (err) {
    showToast("Error deleting profile");
  }
}

function handleResumeFileRead(file) {
  if (!file) return;
  selectedResumeFile = file;

  const defaultState = document.getElementById("dropzoneDefaultState");
  const selectedState = document.getElementById("dropzoneSelectedState");
  const nameEl = document.getElementById("selectedFileName");
  const sizeEl = document.getElementById("selectedFileSize");
  const iconEl = document.getElementById("selectedFileIcon");

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
    let res;
    if (selectedResumeFile) {
      const formData = new FormData();
      formData.append("file", selectedResumeFile);
      if (text && !selectedResumeFile.name.toLowerCase().endsWith(".pdf")) {
        formData.append("resumeText", text);
      }
      res = await fetch("/api/profiles/import-resume", {
        method: "POST",
        body: formData
      });
    } else {
      res = await fetch("/api/profiles/import-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: text })
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

  try {
    const res = await fetch("/api/ai/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });
    const data = await res.json();
    if (data.success) {
      scenarioInput.value = "";
      if (data.action === "scrape_and_tailor" && data.job) {
        await fetchProfiles();
        await fetchJobs();
        const targetJob = allJobs.find(j => j.id === data.job.id) || data.job;
        selectJob(targetJob);
        showToast(`✨ ${data.explanation}`);
        await tailorCurrentJob();
      } else {
        showToast(`✨ ${data.explanation}`);
        await fetchProfiles();
        await fetchJobs();
        if (selectedJob) {
          if (currentStudioTab === "cv") renderCVTab();
          if (currentStudioTab === "cover") renderCoverTab();
          if (currentStudioTab === "ats") renderATSTab();
        }
      }
    } else {
      showToast(data.error || "Failed to run scenario");
    }
  } catch (err) {
    showToast("Error running scenario");
  } finally {
    btnScenarioRun.disabled = false;
    scenarioSpinner.style.display = "none";
    scenarioBtnText.textContent = "Run ↵";
  }
}

// --------------------------------------------------------------------------
// AI Engine Configuration & Health
// --------------------------------------------------------------------------

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
        aiStatusText.textContent = "Claude 3.5";
      } else if (provider === "openai") {
        aiStatusText.textContent = "OpenAI GPT-4o";
      } else {
        aiStatusText.textContent = "Offline Engine";
      }
    } else {
      aiStatusDot.className = "ai-status-dot offline";
      aiStatusText.textContent = `AI: ${provider} (Offline)`;
    }

    // Populate model options
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

  const anthropicModelSelect = document.getElementById("aiAnthropicModelSelect");
  if (anthropicModelSelect && aiConfig.anthropicModel) {
    anthropicModelSelect.value = aiConfig.anthropicModel;
  }
  const openAiModelSelect = document.getElementById("aiOpenAiModelSelect");
  if (openAiModelSelect && aiConfig.openaiModel) {
    openAiModelSelect.value = aiConfig.openaiModel;
  }

  testAiConnection();
  aiConfigModal.style.display = "flex";
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
    anthropicApiKey: aiAnthropicKey.value.trim(),
    anthropicModel: anthropicModelSelect ? anthropicModelSelect.value : "claude-3-5-sonnet-20241022",
    openaiApiKey: aiOpenAiKey.value.trim(),
    openaiModel: openAiModelSelect ? openAiModelSelect.value : "gpt-4o"
  };

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
    }
  } catch (err) {
    showToast("Error saving AI configuration");
  }
}

async function handleAutoSelectBestModel() {
  const provider = document.querySelector('input[name="aiProvider"]:checked')?.value || "ollama";
  const apiKey = provider === "openai" ? aiOpenAiKey.value.trim() : provider === "anthropic" ? aiAnthropicKey.value.trim() : "";

  showToast("Scanning models and computing best value recommendation...");

  try {
    const res = await fetch("/api/ai/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey })
    });
    const data = await res.json();
    if (data.success && data.recommendedModel) {
      if (provider === "ollama") {
        aiOllamaModelSelect.value = data.recommendedModel;
      } else if (provider === "anthropic") {
        const select = document.getElementById("aiAnthropicModelSelect");
        if (select) select.value = data.recommendedModel;
      } else if (provider === "openai") {
        const select = document.getElementById("aiOpenAiModelSelect");
        if (select) {
          // If cloud models returned live list, populate select if not present
          if (data.cloudModels && data.cloudModels.length > 0) {
            select.innerHTML = "";
            data.cloudModels.forEach(m => {
              const opt = document.createElement("option");
              opt.value = m;
              opt.textContent = m;
              select.appendChild(opt);
            });
          }
          select.value = data.recommendedModel;
        }
      }

      showToast(`✨ Recommended: ${data.recommendedModel} — ${data.reason}`);
    } else {
      showToast("Could not determine model recommendation");
    }
  } catch (err) {
    showToast("Error fetching model recommendation");
  }
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
      <span class="nav-item-left">🇬🇧 Nationwide (Sponsored)</span>
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

  const countAllEl = document.getElementById("countAll");
  const countRemoteEl = document.getElementById("countRemote");
  const countNearEl = document.getElementById("countNear");
  const countUkHybridSponsoredEl = document.getElementById("countUkHybridSponsored");
  const countDraftedEl = document.getElementById("countDrafted");
  const countAppliedEl = document.getElementById("countApplied");
  const countSponsorsEl = document.getElementById("countSponsors");

  if (countAllEl) countAllEl.textContent = total;
  if (countRemoteEl) countRemoteEl.textContent = remote;
  if (countNearEl) countNearEl.textContent = near;
  if (countUkHybridSponsoredEl) countUkHybridSponsoredEl.textContent = ukHybridSponsored;
  if (countDraftedEl) countDraftedEl.textContent = drafted;
  if (countAppliedEl) countAppliedEl.textContent = applied;
  if (countSponsorsEl) countSponsorsEl.textContent = sponsors;

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
    uk_hybrid_sponsored: "🇬🇧 Nationwide (Sponsored Across UK)",
    drafted: "Drafted Applications",
    applied: "Applied & Active",
    sponsor_verified: "Verified A-Sponsors"
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
    const portalTag = job.portal === "freehire-ats" ? 
      '<span class="meta-pill" style="color: #6ee7b7; border-color: rgba(110,231,183,0.3); font-weight: 500;">⚡ Direct ATS</span>' : 
      '<span class="meta-pill" style="color: #93c5fd; border-color: rgba(147,197,253,0.3); font-weight: 500;">🔗 LinkedIn</span>';

    card.innerHTML = `
      <div class="job-card-header">
        <div class="job-card-title">${escapeHtml(job.title)}</div>
        <div class="job-card-fit">${job.fit_score}% match</div>
      </div>
      <div class="job-card-company">${escapeHtml(job.company)}</div>
      <div class="job-card-meta">
        ${relativeDateBadge}
        ${portalTag}
        <span class="meta-pill">${escapeHtml(job.commute_tag)}</span>
        ${job.sponsor_verified ? '<span class="meta-pill sponsor">🛡️ A-Sponsor</span>' : ''}
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
    atsScore.textContent = `${job.fit_score || 95}%`;
    atsBadge.style.display = "inline-flex";
  }

  if (job.url) {
    studioLinkBtn.href = job.url;
    studioLinkBtn.style.display = "inline-flex";
    studioLinkBtn.textContent = job.portal === "freehire-ats" ? "Open ATS Listing ↗" : "Open on LinkedIn ↗";
  } else {
    studioLinkBtn.style.display = "none";
  }

  // Sponsor Banner
  if (job.sponsor_verified) {
    studioSponsorBanner.style.display = "flex";
    studioSponsorText.textContent = `UK Home Office Verified Sponsor: ${job.sponsor_label}`;
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
        <button class="btn-primary" id="btnDownloadCVPdf">📥 Download PDF</button>
        <button class="btn-secondary" id="btnOpenPreviewCV" title="Open PDF in native macOS Preview">👁️ Preview</button>
        <button class="btn-secondary" id="btnRevealCV" title="Reveal PDF in macOS Finder">📂 Finder</button>
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
  let skillsHtmlToRender = parsed.skillsHtml;
  if (!skillsHtmlToRender && activeProfile?.skills) {
    const s = activeProfile.skills;
    const parts = [];
    if (s.cloud && s.cloud.length) parts.push(`<b>Cloud Platforms</b>: ${s.cloud.join(", ")}`);
    if (s.containers && s.containers.length) parts.push(`<b>Containers & GitOps</b>: ${s.containers.join(", ")}`);
    else if (s.devops && s.devops.length) parts.push(`<b>Containers & GitOps</b>: ${s.devops.join(", ")}`);
    if (s.iac && s.iac.length) parts.push(`<b>Infrastructure as Code</b>: ${s.iac.join(", ")}`);
    if (s.cicd && s.cicd.length) parts.push(`<b>CI/CD & Build Tools</b>: ${s.cicd.join(", ")}`);
    if (s.monitoring && s.monitoring.length) parts.push(`<b>Monitoring & SRE</b>: ${s.monitoring.join(", ")}`);
    if (s.security && s.security.length) parts.push(`<b>Security</b>: ${s.security.join(", ")}`);
    if (s.languages && s.languages.length) parts.push(`<b>Languages & Frameworks</b>: ${s.languages.join(", ")}`);
    if (s.tools && s.tools.length) parts.push(`<b>Tools & Automation</b>: ${s.tools.join(", ")}`);
    skillsHtmlToRender = parts.join("<br>");
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
              ${exp.items.map(bullet => `<li>${bullet}</li>`).join("")}
            </ul>
          </div>
        `).join("")}
      </div>` : ''}

      ${skillsHtmlToRender ? `
      <div class="doc-section">
        <div class="doc-section-title">Technical Skills</div>
        <div style="font-size: 12px; color: #1f2937; line-height: 1.6;">${skillsHtmlToRender}</div>
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
              ${proj.items.map(bullet => `<li>${bullet}</li>`).join("")}
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

async function renderCoverTab() {
  const coverPath = selectedJob.cover_file || "";

  studioContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; max-width: 820px; margin-left: auto; margin-right: auto;">
      <div style="font-size: 13px; color: var(--text-secondary);">
        <b>Format:</b> Executive Formal Letterhead (Targeted to ${escapeHtml(selectedJob.company)})
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn-primary" id="btnDownloadCoverPdf">📥 Download PDF</button>
        <button class="btn-secondary" id="btnOpenPreviewCover" title="Open PDF in native macOS Preview">👁️ Preview</button>
        <button class="btn-secondary" id="btnRevealCover" title="Reveal PDF in macOS Finder">📂 Finder</button>
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

      <p style="margin-bottom: 14px;">Dear Hiring Team at ${escapeHtml(selectedJob.company)},</p>

      <p style="margin-bottom: 14px;">
        I am writing to express my strong interest in the <b>${escapeHtml(cleanRole)}</b> role. With deep hands-on expertise in automated cloud infrastructure, container orchestration, and resilient CI/CD pipelines, I focus on delivering rock-solid platforms that empower engineering squads to release with speed and confidence.
      </p>

      <p style="margin-bottom: 14px;">
        In my career, I have designed and maintained high-throughput production cloud platforms, executing multi-version cluster upgrades with zero downtime and authoring infrastructure-as-code automation with strict least-privilege security controls.
      </p>

      <p style="margin-bottom: 14px;">
        The technical roadmap at ${escapeHtml(selectedJob.company)} aligns directly with my engineering mindset. I bring pragmatic architecture experience coupled with relentless focus on developer velocity and system reliability.
      </p>

      <p style="margin-bottom: 24px;">
        Thank you for your time and consideration. I welcome the opportunity to discuss how my background can support your team.
      </p>

      <div>
        Sincerely,<br><br>
        <b>${escapeHtml(activeProfile?.name || "Candidate")}</b><br>
        <span style="font-size: 12px; color: #6b7280;">${escapeHtml(activeProfile?.headline || "")}</span>
      </div>
    </div>
  `;
}

function renderDetailsTab() {
  const jdText = selectedJob.full_jd || selectedJob.summary || "Full Job Description not available.";
  const analysis = selectedJob.analysis || {};
  const fitScore = analysis.overallScore || selectedJob.fit_score || 95;
  const verdict = analysis.verdict || (fitScore >= 95 ? "Exceptional Fit" : fitScore >= 85 ? "Strong Fit" : "Good Fit");

  const techScore = analysis.dimensions?.technical?.score ?? fitScore;
  const techNote = analysis.dimensions?.technical?.note || "Core cloud and platform engineering skills align with role requirements.";
  const expScore = analysis.dimensions?.experience?.score ?? (fitScore >= 90 ? 92 : 85);
  const expNote = analysis.dimensions?.experience?.note || "Production experience directly supports the role seniority.";
  const behScore = analysis.dimensions?.behavioral?.score ?? 88;
  const behNote = analysis.dimensions?.behavioral?.note || "Demonstrated collaboration, ownership, and technical leadership.";

  const locVerdict = analysis.gates?.location?.verdict || "PASS";
  const eligVerdict = analysis.gates?.eligibility?.verdict || (selectedJob.sponsor_verified ? "PASS" : "UNVERIFIED");

  // Matched vs Gap skills
  const matchedSkills = analysis.matchedKeywords?.length 
    ? analysis.matchedKeywords 
    : (selectedJob.key_skills || []);
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
            <div class="ats-dim-score" style="color: ${selectedJob.sponsor_verified ? '#34d399' : '#38bdf8'};">
              ${selectedJob.sponsor_verified ? "SPONSORED" : "VERIFY"}
            </div>
            <div class="ats-dim-bar"><div class="ats-dim-fill" style="width: 100%; background: ${selectedJob.sponsor_verified ? '#34d399' : '#38bdf8'};"></div></div>
            <div class="ats-dim-note">${selectedJob.sponsor_verified ? "Verified UK A-Rated Sponsor" : "Register check recommended"}</div>
          </div>
        </div>

        <!-- Skills Breakdown -->
        <div style="border-top: 1px solid var(--border-subtle); padding-top: 14px; margin-top: 4px;">
          <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px; color: #cbd5e1;">Matched Core Competencies (${matchedSkills.length}):</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;">
            ${matchedSkills.map(s => `<span style="padding: 3px 9px; background: rgba(48, 209, 88, 0.18); border: 1px solid rgba(48, 209, 88, 0.35); color: #34d399; border-radius: 4px; font-size: 11.5px; font-weight: 600;">✓ ${escapeHtml(s)}</span>`).join("")}
            ${matchedSkills.length === 0 ? '<span style="font-size: 12px; color: #94a3b8;">Common cloud & devops skills apply.</span>' : ''}
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
            ${selectedJob.sponsor_verified ? "UK Home Office Verified Licensed Sponsor" : "UK Right to Work & Visa Assessment"}
          </div>
          <div class="sponsor-detail-text">
            <b>Employer:</b> ${escapeHtml(selectedJob.company)} &nbsp;·&nbsp; 
            <b>License Type:</b> ${escapeHtml(selectedJob.sponsor_label)} &nbsp;·&nbsp;
            <b>Status:</b> ${selectedJob.sponsor_verified ? "✅ Home Office A-Rating (Eligible for Skilled Worker CoS)" : "🔍 Verify on Home Office Sponsor Register"}<br>
            <b>Candidate Work Status:</b> ${activeProfile?.visaSponsorshipRequired ? "Candidate holds legal UK work authorization; Skilled Worker sponsorship transfer required." : "Candidate possesses unrestricted UK work rights."}<br>
            <b>Application Advice:</b> ${selectedJob.sponsor_verified ? "Answer 'Yes' to requiring sponsorship. This employer has an active Home Office CoS allocation for Skilled Workers." : "Check job posting details regarding visa sponsorship eligibility before submission."}
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
    `Yes, I currently hold legal work authorization in the UK and will require Skilled Worker visa sponsorship to transfer to ${selectedJob.company}.` :
    "No, I have unrestricted right to work in the UK and do not require sponsorship.";

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
          "1 month notice period (can be negotiated if required)."
        </div>
      </div>

      <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 16px;">
        <h4 style="font-size: 14px; color: var(--apple-blue); margin-bottom: 6px;">Are you willing to work in a hybrid schedule in ${selectedJob.location}?</h4>
        <div style="font-size: 12px; color: var(--text-secondary); background: rgba(0,0,0,0.25); padding: 8px; border-radius: 6px;">
          "Yes, I am based in ${escapeHtml(activeProfile?.location || 'UK')} and fully comfortable with hybrid working in ${escapeHtml(selectedJob.location)}."
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
      // 1. Copy PDF directly to user's ~/Downloads directory and reveal in Finder
      try {
        const saveRes = await fetch("/api/save-to-downloads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: result.repoPath, filename: result.filename, open: false })
        });
        const saveData = await saveRes.json();
        if (saveData.success) {
          showToast(`✅ PDF saved to Downloads: ${result.filename}`);
        }
      } catch (saveErr) {
        console.warn("Could not copy to ~/Downloads:", saveErr);
      }

      // 2. Open PDF in macOS Preview directly (never navigates WKWebView!)
      fetch("/api/open-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: result.repoPath })
      }).catch(() => {});

      showToast(`✨ Native ATS PDF compiled & opened in Preview: ${result.filename}`);
    } else {
      console.error("Compilation error:", result);
      showToast(`⚠️ PDF compilation failed: ${result.error || "Check LaTeX syntax"}`);
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
      showToast("✅ Opened in macOS Preview");
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
      showToast("📂 Revealed in macOS Finder");
    } else {
      await fetch("/api/reveal-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: docPath })
      });
      showToast("📂 Revealed in macOS Finder");
    }
  } catch {
    showToast("Could not reveal file in Finder");
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

async function triggerScrape() {
  scrapeSpinner.style.display = "inline-block";
  scrapeLabel.textContent = "Searching Live...";
  btnScrape.disabled = true;

  try {
    const res = await fetch("/api/scrape", { method: "POST" });
    const data = await res.json();
    if (data.success) {
      showToast(`Scrape completed! ${data.addedCount} new roles found.`);
      await fetchJobs();
    } else {
      showToast("Scrape completed.");
    }
  } catch (err) {
    showToast("Scrape error");
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
  toast.innerHTML = `<span>✨</span><span>${message}</span>`;
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

function cleanCandidateHeadline(role, fallback = "Senior Platform & DevOps Engineer") {
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
                  .replace(/\\textbf\{([^}]*)\}/g, "<b>$1</b>")
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
                  .replace(/\\textbf\{([^}]*)\}/g, "<b>$1</b>")
                  .trim();
        });
        if (name) result.projects.push({ name, tools, category, items });
      });
    }

    // 4. Skills: support \section{Technical Skills}
    const skillsMatch = latex.match(/\\section\{Technical Skills\}[\s\S]*?\\begin\{itemize\}[\s\S]*?\\small\{\\item\{([\s\S]*?)\}\}\s*\\end\{itemize\}/i);
    if (skillsMatch) {
      result.skillsHtml = skillsMatch[1]
        .replace(/\\textbf\{([^}]*)\}/g, "<b>$1</b>")
        .replace(/\\\\/g, "<br>")
        .replace(/\\&/g, "&")
        .replace(/\\_/g, "_")
        .trim();
    }
  } catch (err) {
    console.error("LaTeX parse error:", err);
  }
  return result;
}
