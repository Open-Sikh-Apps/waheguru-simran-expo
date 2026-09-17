#!/usr/bin/env node
/**
 * After `npx expo prebuild`, wires Android release signing from
 * credentials/keystore.properties (gitignored) into the generated project.
 *
 * Usage: node scripts/apply-android-signing.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const propsSrc = path.join(root, 'credentials', 'keystore.properties');
const androidDir = path.join(root, 'android');
const appGradlePath = path.join(androidDir, 'app', 'build.gradle');
const propsDest = path.join(androidDir, 'keystore.properties');

if (!fs.existsSync(androidDir)) {
  console.error('android/ not found. Run: npx expo prebuild --platform android');
  process.exit(1);
}

if (!fs.existsSync(propsSrc)) {
  console.error(
    'Missing credentials/keystore.properties\n' +
      'Copy credentials/keystore.properties.example and fill in your upload keystore values.',
  );
  process.exit(1);
}

const props = fs.readFileSync(propsSrc, 'utf8');
const storeFileMatch = props.match(/^\s*storeFile\s*=\s*(.+)\s*$/m);
if (!storeFileMatch) {
  console.error('keystore.properties must include storeFile=...');
  process.exit(1);
}

const storeFileName = storeFileMatch[1].trim();
const storeSrc = path.join(root, 'credentials', storeFileName);
if (!fs.existsSync(storeSrc)) {
  console.error(`Keystore file not found: credentials/${storeFileName}`);
  process.exit(1);
}

fs.copyFileSync(propsSrc, propsDest);
fs.copyFileSync(storeSrc, path.join(androidDir, 'app', storeFileName));

let gradle = fs.readFileSync(appGradlePath, 'utf8');

const loadBlock = `def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

`;

if (!gradle.includes('keystorePropertiesFile')) {
  gradle = gradle.replace(/^android\s*\{/m, `${loadBlock}android {`);
}

const releaseSigningConfig = `        release {
            if (keystorePropertiesFile.exists()) {
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
            }
        }
`;

if (!gradle.includes('signingConfigs') || !/signingConfigs\s*\{[\s\S]*?release\s*\{/.test(gradle)) {
  if (/signingConfigs\s*\{\s*debug\s*\{/.test(gradle)) {
    gradle = gradle.replace(
      /(signingConfigs\s*\{\s*debug\s*\{[\s\S]*?\n\s*\}\n)/,
      `$1${releaseSigningConfig}`,
    );
  } else {
    console.error('Could not locate signingConfigs.debug in android/app/build.gradle');
    process.exit(1);
  }
}

if (/release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.debug/.test(gradle)) {
  gradle = gradle.replace(
    /(release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
    '$1signingConfig signingConfigs.release',
  );
}

fs.writeFileSync(appGradlePath, gradle);
console.log('Android release signing configured from credentials/keystore.properties');
console.log('Next: cd android && ./gradlew bundleRelease');
console.log('AAB: android/app/build/outputs/bundle/release/app-release.aab');
