# Search Queries for Job Scraper

## Installed portal CLIs (primary for `/scrape`)

`/scrape` discovers every portal skill under `.agents/skills/*/SKILL.md` and runs its CLI first.
- Primary global/UK CLI: `linkedin-search`
- Secondary aggregator CLI: `freehire-search`
- Regional portals: `jobindex-search`, `jobnet-search`, `jobbank-search`, `jobdanmark-search`

## Priority Locations & Preference Hierarchy
1. **Priority 1:** Fully Remote
2. **Priority 2:** Local Hybrid (e.g., within 50–70 miles of target location)
3. **Priority 3:** Regional Tech Hubs
4. **Priority 4:** Nationwide Hybrid (with relocation or visa sponsorship where applicable)

## Query Categories

### Priority 1: Senior Platform & Cloud Infrastructure
Primary focus matching core expertise in Cloud, Kubernetes, Terraform, and Platform Engineering.
```
-q "Senior Platform Engineer" -l "Remote, United Kingdom"
-q "Senior Platform Engineer" -l "London"
-q "Senior Platform Engineer" -l "Manchester"
-q "Cloud Platform Engineer" -l "Remote"
```

### Priority 2: Senior DevOps & GitOps
Focus on CI/CD automation, Kubernetes clusters, Docker, Helm, GitHub Actions, and GitOps deployments.
```
-q "Senior DevOps Engineer" -l "Remote, United Kingdom"
-q "Senior DevOps Engineer" -l "London"
-q "Senior DevOps Engineer" -l "Manchester"
-q "DevOps Consultant" -l "Remote"
```

### Priority 3: Site Reliability Engineering (SRE)
Focus on cluster observability, Grafana, Prometheus, high availability, and multi-region resilience.
```
-q "Site Reliability Engineer" -l "Remote, United Kingdom"
-q "Senior SRE" -l "London"
```

### Priority 4: Cloud Engineering & Specialists
```
-q "Senior Cloud Engineer" -l "Remote, United Kingdom"
-q "Senior Cloud Infrastructure Engineer" -l "London"
```

## Filtering Rules
- Configured dynamically per candidate profile in `data/profiles.json` or the Job Search Studio UI.
