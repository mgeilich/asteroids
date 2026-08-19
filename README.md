# NEO Planetary Defense Radar TRMNL Plugin

A serverless, low-maintenance TRMNL e-ink plugin that displays upcoming Near-Earth Object (NEO) flybys on a retro circular radar timeline.

## Features
*   **Concentric Radar Sweep**: Visualizes asteroid flybys within the next 7 days. Center represents Earth. Ring markings at 10, 20, 30, and 40 Lunar Distances (LD).
*   **Circular Timeline**: The angle represents the encounter time (12 o'clock is "now", sweeping clockwise to 360° for Day 7). Ticks mark the UTC midnight of upcoming days.
*   **System Alerts**: Automatically triggers alert statuses if any hazardous objects approach within 15 LD.
*   **Robust Caching**: Utilizes Cloud Firestore to cache calculations for 1 hour. This ensures rapid loading speeds and prevents hitting NASA's API rate limits. If NASA's API is temporarily down, the plugin gracefully falls back to displaying the last successfully cached scan.
*   **Theme-Ready Vector Graphics**: Rendered via native SVGs with `stroke="currentColor"` and `fill="currentColor"`, allowing the interface to seamlessly invert on TRMNL's light and dark themes.

---

## Technical Architecture

```
├── .firebaserc                    # Firebase project configuration
├── firebase.json                  # Services mappings and configurations
├── firestore.rules                # Database lockdown security rules
├── firestore.indexes.json         # Index definitions (none needed)
├── templates/
│   ├── full.liquid                # Full screen layout template
│   ├── half_horizontal.liquid     # Half-screen horizontal layout template
│   ├── half_vertical.liquid       # Half-screen vertical layout template
│   └── quadrant.liquid            # Quadrant/quarter-screen layout template
└── functions/
    ├── main.py                    # Cloud Function entrypoint & caching logic
    ├── requirements.txt           # Python backend dependencies
    ├── nasa_api.py                # NASA NeoWS API requests handler
    └── radar_calculator.py        # Coordinate mapping logic
```

---

## Data Payload Schema

The TRMNL Serverless transform script expects the following JSON data payload format from the polling endpoint:

```json
{
  "candidates": [
    {
      "id": "1234567",
      "name": "(2026 NY1)",
      "miss_distance_ld": 4.2,
      "velocity_kph": 32100,
      "avg_diameter": 150.0,
      "is_hazardous": true,
      "epoch": 1787140800000
    }
  ],
  "total_count": 1
}
```

*   `candidates`: List of nearby asteroid encounters within the upcoming 7 days.
*   `epoch`: Milliseconds UTC timestamp of closest approach.
*   `miss_distance_ld`: Distance of closest approach in Lunar Distances (LD).
*   `avg_diameter`: Estimated diameter of the asteroid in meters (m).
*   `is_hazardous`: Boolean flag indicating if the asteroid is classified as potentially hazardous.
*   `total_count`: Total number of detected encounters.

---

## Setup & Deployment

You can deploy the Firebase functions and update the TRMNL markup manually, or configure GitHub Actions for fully automated deployments.

### 1. Automated Deployment via GitHub Actions (Recommended)

A GitHub Actions workflow is configured in `.github/workflows/deploy.yml` to automatically build and deploy the codebase whenever you push to the `main` branch.

#### Configuration Steps:
1. **Configure Google Cloud Credentials**:
   * Create a Service Account in the Google Cloud Console for your Firebase project (`neo-radar-trmnl-2026`).
   * Grant the Service Account roles required to deploy Cloud Functions (e.g., `Cloud Functions Developer`, `Firebase Admin`, `API Gateway Admin`).
   * Generate a **JSON Key** for the Service Account and download it.
   * Add the contents of this JSON key file as a GitHub Repository Secret named **`GCP_SA_KEY`** (under *Settings -> Secrets and variables -> Actions*).
2. **Configure TRMNL Credentials**:
   * Retrieve your TRMNL API key from your host's CLI configuration file (`~/.config/trmnlp/config.yml` under `api_key`).
   * Add this API key as a GitHub Repository Secret named **`TRMNL_API_KEY`**.
3. **Push to GitHub**:
   * Push your changes to the `main` branch. GitHub Actions will automatically deploy both the Firebase Functions/Rules and update your TRMNL Plugin templates.

---

### 2. Manual Setup & Deployment

If you prefer to deploy manually from your local machine:

#### Firebase Deployment:
1. Verify you are logged in to the Firebase CLI:
   ```bash
   npx -y firebase-tools@latest login
   ```
2. Deploy the Firestore rules and Cloud Functions:
   ```bash
   npx -y firebase-tools@latest deploy
   ```
3. Copy the deployed `Function URL (neo_radar)` from the output.

#### TRMNL Plugin Template Deployment:
1. Verify you have the `trmnlp` CLI installed:
   ```bash
   gem install trmnl_preview
   ```
2. Authenticate to the TRMNL server:
   ```bash
   trmnlp login
   ```
3. Push your templates and configuration directly to the TRMNL portal:
   ```bash
   trmnlp push
   ```

---

### 3. Configure NASA API Key (Optional but Recommended)
By default, the Cloud Function uses NASA's public `DEMO_KEY` which is rate-limited. To configure your own personal API key:
1. Get a free NASA API key at [api.nasa.gov](https://api.nasa.gov/).
2. Set the key as an environment variable in your Firebase Cloud Function config:
   ```bash
   npx -y firebase-tools@latest functions:secrets:set NASA_API_KEY=your_nasa_api_key
   # Or set it as an environment variable in the Google Cloud Console for the Cloud Run function
   ```

---

### 4. Setup TRMNL Plugin
1. Log in to your [trmnl.com](https://usetrmnl.com/) account.
2. Go to **Plugins** -> **Private Plugins** -> **Add New**.
3. Choose **Polling** strategy.
4. Configure the settings:
   * **Polling URL**: Paste the URL of your deployed Firebase Cloud Function (e.g. `https://neo-radar-trmnl-2026.a.run.app` or similar).
   * **HTTP Method**: `GET`
5. Since we use `trmnlp push`, the Markup Editor fields will be filled automatically. If you want to update them manually, copy and paste the contents of each file from the `templates/` directory into its corresponding viewport size box (Full, Half Horizontal, Half Vertical, Quadrant).
6. Save the plugin settings. Your TRMNL device will now begin displaying the Planetary Defense Radar!

