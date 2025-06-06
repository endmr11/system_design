# Release Management

## Overview

Release management for mobile applications involves coordinating app store deployments, managing release cycles, automating distribution pipelines, and ensuring smooth rollouts across Android and iOS platforms. This documentation covers comprehensive release management strategies with CI/CD integration and automated testing.

## Release Pipeline Architecture

### CI/CD Pipeline Configuration

#### GitHub Actions Workflow

```yaml
# .github/workflows/mobile-release.yml
name: Mobile Release Pipeline

on:
  push:
    branches: [main, release/*]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  JAVA_VERSION: '11'
  RUBY_VERSION: '3.0'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test:ci
      
      - name: Run linting
        run: npm run lint
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: |
            coverage/
            test-results.xml

  build-android:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v')
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Java
        uses: actions/setup-java@v3
        with:
          java-version: ${{ env.JAVA_VERSION }}
          distribution: 'temurin'
      
      - name: Setup Android SDK
        uses: android-actions/setup-android@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Decode keystore
        run: |
          echo ${{ secrets.ANDROID_KEYSTORE_BASE64 }} | base64 -d > android/app/release.keystore
      
      - name: Build Android Bundle
        run: |
          cd android
          ./gradlew bundleRelease
        env:
          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
      
      - name: Upload Android Bundle
        uses: actions/upload-artifact@v3
        with:
          name: android-bundle
          path: android/app/build/outputs/bundle/release/app-release.aab
      
      - name: Upload to Play Console
        if: startsWith(github.ref, 'refs/tags/v')
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON }}
          packageName: com.yourcompany.yourapp
          releaseFiles: android/app/build/outputs/bundle/release/app-release.aab
          track: internal
          status: completed

  build-ios:
    needs: test
    runs-on: macos-latest
    if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v')
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      
      - name: Setup Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: ${{ env.RUBY_VERSION }}
          bundler-cache: true
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install CocoaPods dependencies
        run: |
          cd ios
          pod install --repo-update
      
      - name: Setup certificates and provisioning profiles
        run: |
          echo ${{ secrets.IOS_CERTIFICATE_BASE64 }} | base64 -d > ios/certificate.p12
          echo ${{ secrets.IOS_PROVISIONING_PROFILE_BASE64 }} | base64 -d > ios/profile.mobileprovision
          
          security create-keychain -p "" build.keychain
          security import ios/certificate.p12 -k build.keychain -P ${{ secrets.IOS_CERTIFICATE_PASSWORD }} -A
          security list-keychains -s build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p "" build.keychain
          security set-keychain-settings -t 3600 -u build.keychain
          
          mkdir -p ~/Library/MobileDevice/Provisioning\ Profiles
          cp ios/profile.mobileprovision ~/Library/MobileDevice/Provisioning\ Profiles/
      
      - name: Build iOS Archive
        run: |
          cd ios
          xcodebuild clean archive \
            -workspace YourApp.xcworkspace \
            -scheme YourApp \
            -archivePath YourApp.xcarchive \
            -configuration Release \
            CODE_SIGN_IDENTITY="${{ secrets.IOS_CODE_SIGN_IDENTITY }}" \
            PROVISIONING_PROFILE_SPECIFIER="${{ secrets.IOS_PROVISIONING_PROFILE_NAME }}"
      
      - name: Export IPA
        run: |
          cd ios
          xcodebuild -exportArchive \
            -archivePath YourApp.xcarchive \
            -exportPath . \
            -exportOptionsPlist ExportOptions.plist
      
      - name: Upload iOS IPA
        uses: actions/upload-artifact@v3
        with:
          name: ios-ipa
          path: ios/YourApp.ipa
      
      - name: Upload to App Store Connect
        if: startsWith(github.ref, 'refs/tags/v')
        run: |
          cd ios
          bundle exec fastlane upload_to_testflight

  deploy-staging:
    needs: [build-android, build-ios]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: Deploy to Firebase App Distribution
        uses: wzieba/Firebase-Distribution-Github-Action@v1
        with:
          appId: ${{ secrets.FIREBASE_ANDROID_APP_ID }}
          serviceCredentialsFileContent: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_JSON }}
          groups: testers
          file: android/app/build/outputs/bundle/release/app-release.aab
          releaseNotes: |
            Automated staging build from commit ${{ github.sha }}
            
            Changes in this build:
            ${{ github.event.head_commit.message }}

  create-release:
    needs: [build-android, build-ios]
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v')
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Generate Release Notes
        id: release-notes
        run: |
          VERSION=${GITHUB_REF#refs/tags/}
          CHANGELOG=$(git log --pretty=format:"- %s" $(git describe --tags --abbrev=0 HEAD^)..HEAD)
          
          cat > release-notes.md << EOF
          ## Release $VERSION
          
          ### Changes
          $CHANGELOG
          
          ### Downloads
          - Android: Available on Google Play Store
          - iOS: Available on App Store
          EOF
          
          echo "version=$VERSION" >> $GITHUB_OUTPUT
      
      - name: Create GitHub Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ steps.release-notes.outputs.version }}
          body_path: release-notes.md
          draft: false
          prerelease: false
```

#### Fastlane Configuration

```ruby
# ios/fastlane/Fastfile
default_platform(:ios)

platform :ios do
  before_all do
    ensure_git_status_clean
    setup_circle_ci if ENV['CI']
  end

  desc "Run tests"
  lane :test do
    scan(
      workspace: "YourApp.xcworkspace",
      scheme: "YourApp",
      clean: true,
      output_directory: "./test_output",
      output_types: "html,junit"
    )
  end

  desc "Build for testing"
  lane :build_for_testing do
    gym(
      workspace: "YourApp.xcworkspace",
      scheme: "YourApp",
      configuration: "Debug",
      clean: true,
      build_path: "./build",
      output_directory: "./build",
      skip_package_ipa: true,
      skip_archive: true,
      destination: "generic/platform=iOS Simulator"
    )
  end

  desc "Build and upload to TestFlight"
  lane :beta do
    ensure_git_branch(branch: 'main')
    
    increment_build_number(
      build_number: latest_testflight_build_number + 1
    )
    
    gym(
      workspace: "YourApp.xcworkspace",
      scheme: "YourApp",
      configuration: "Release",
      clean: true,
      export_method: "app-store",
      output_directory: "./build"
    )
    
    upload_to_testflight(
      skip_waiting_for_build_processing: false,
      notify_external_testers: true,
      groups: ["Beta Testers"],
      changelog: changelog_from_git_commits(
        commits_count: 10,
        pretty: "- %s"
      )
    )
    
    slack(
      message: "New iOS beta build uploaded to TestFlight! 🚀",
      success: true,
      channel: "#mobile-releases"
    )
  end

  desc "Release to App Store"
  lane :release do
    ensure_git_branch(branch: 'main')
    ensure_git_status_clean
    
    version = get_version_number(xcodeproj: "YourApp.xcodeproj")
    
    gym(
      workspace: "YourApp.xcworkspace",
      scheme: "YourApp",
      configuration: "Release",
      clean: true,
      export_method: "app-store"
    )
    
    deliver(
      submit_for_review: false,
      automatic_release: false,
      force: true,
      metadata_path: "./fastlane/metadata",
      screenshots_path: "./fastlane/screenshots",
      skip_binary_upload: false,
      skip_screenshots: false,
      skip_metadata: false
    )
    
    slack(
      message: "iOS version #{version} submitted to App Store! 📱",
      success: true,
      channel: "#mobile-releases"
    )
  end

  desc "Update certificates and provisioning profiles"
  lane :certificates do
    match(
      type: "development",
      app_identifier: "com.yourcompany.yourapp"
    )
    
    match(
      type: "appstore",
      app_identifier: "com.yourcompany.yourapp"
    )
  end

  error do |lane, exception|
    slack(
      message: "iOS build failed in lane #{lane}: #{exception.message}",
      success: false,
      channel: "#mobile-releases"
    )
  end
end

platform :android do
  desc "Run tests"
  lane :test do
    gradle(task: "test")
  end

  desc "Build debug APK"
  lane :debug do
    gradle(task: "assembleDebug")
  end

  desc "Build and upload to Play Console internal track"
  lane :beta do
    gradle(
      task: "bundleRelease",
      properties: {
        "android.injected.signing.store.file" => ENV["ANDROID_KEYSTORE_PATH"],
        "android.injected.signing.store.password" => ENV["ANDROID_KEYSTORE_PASSWORD"],
        "android.injected.signing.key.alias" => ENV["ANDROID_KEY_ALIAS"],
        "android.injected.signing.key.password" => ENV["ANDROID_KEY_PASSWORD"]
      }
    )
    
    upload_to_play_store(
      track: "internal",
      aab: "app/build/outputs/bundle/release/app-release.aab",
      release_status: "completed"
    )
    
    slack(
      message: "New Android beta build uploaded to Play Console! 🤖",
      success: true,
      channel: "#mobile-releases"
    )
  end

  desc "Release to Play Store"
  lane :release do
    gradle(
      task: "bundleRelease",
      properties: {
        "android.injected.signing.store.file" => ENV["ANDROID_KEYSTORE_PATH"],
        "android.injected.signing.store.password" => ENV["ANDROID_KEYSTORE_PASSWORD"],
        "android.injected.signing.key.alias" => ENV["ANDROID_KEY_ALIAS"],
        "android.injected.signing.key.password" => ENV["ANDROID_KEY_PASSWORD"]
      }
    )
    
    upload_to_play_store(
      track: "production",
      aab: "app/build/outputs/bundle/release/app-release.aab",
      release_status: "draft"
    )
    
    slack(
      message: "Android release uploaded to Play Store! 🎉",
      success: true,
      channel: "#mobile-releases"
    )
  end

  error do |lane, exception|
    slack(
      message: "Android build failed in lane #{lane}: #{exception.message}",
      success: false,
      channel: "#mobile-releases"
    )
  end
end
```

## Version Management System

### Semantic Versioning Implementation

```javascript
// scripts/version-manager.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class VersionManager {
  constructor() {
    this.packageJsonPath = path.join(process.cwd(), 'package.json');
    this.androidGradlePath = path.join(process.cwd(), 'android/app/build.gradle');
    this.iosProjectPath = path.join(process.cwd(), 'ios/YourApp.xcodeproj/project.pbxproj');
    this.iosInfoPlistPath = path.join(process.cwd(), 'ios/YourApp/Info.plist');
  }

  getCurrentVersion() {
    const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    return packageJson.version;
  }

  incrementVersion(type = 'patch') {
    const currentVersion = this.getCurrentVersion();
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    
    let newVersion;
    switch (type) {
      case 'major':
        newVersion = `${major + 1}.0.0`;
        break;
      case 'minor':
        newVersion = `${major}.${minor + 1}.0`;
        break;
      case 'patch':
      default:
        newVersion = `${major}.${minor}.${patch + 1}`;
        break;
    }
    
    this.updateAllVersions(newVersion);
    return newVersion;
  }

  updateAllVersions(version) {
    this.updatePackageJson(version);
    this.updateAndroidVersion(version);
    this.updateiOSVersion(version);
    
    console.log(`✅ Updated all platform versions to ${version}`);
  }

  updatePackageJson(version) {
    const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    packageJson.version = version;
    fs.writeFileSync(this.packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log(`Updated package.json to version ${version}`);
  }

  updateAndroidVersion(version) {
    let gradleContent = fs.readFileSync(this.androidGradlePath, 'utf8');
    
    // Update versionName
    gradleContent = gradleContent.replace(
      /versionName\s+"[^"]+"/,
      `versionName "${version}"`
    );
    
    // Increment versionCode
    const versionCodeMatch = gradleContent.match(/versionCode\s+(\d+)/);
    if (versionCodeMatch) {
      const currentVersionCode = parseInt(versionCodeMatch[1]);
      const newVersionCode = currentVersionCode + 1;
      gradleContent = gradleContent.replace(
        /versionCode\s+\d+/,
        `versionCode ${newVersionCode}`
      );
    }
    
    fs.writeFileSync(this.androidGradlePath, gradleContent);
    console.log(`Updated Android version to ${version}`);
  }

  updateiOSVersion(version) {
    // Update Xcode project
    if (fs.existsSync(this.iosProjectPath)) {
      try {
        execSync(`agvtool new-marketing-version ${version}`, { 
          cwd: path.dirname(this.iosProjectPath),
          stdio: 'pipe'
        });
        
        execSync(`agvtool next-version -all`, { 
          cwd: path.dirname(this.iosProjectPath),
          stdio: 'pipe'
        });
        
        console.log(`Updated iOS version to ${version}`);
      } catch (error) {
        console.warn('Could not update iOS version automatically. Please update manually.');
      }
    }
  }

  generateChangelog(version) {
    try {
      const gitLog = execSync('git log --oneline --since="1 week ago"', { encoding: 'utf8' });
      const commits = gitLog.trim().split('\n').filter(line => line.length > 0);
      
      const changelog = `
## Version ${version} - ${new Date().toISOString().split('T')[0]}

### Changes
${commits.map(commit => `- ${commit.substring(8)}`).join('\n')}

### Technical Details
- Build Date: ${new Date().toISOString()}
- Git Commit: ${execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()}
- Environment: ${process.env.NODE_ENV || 'development'}
`;

      const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
      let existingChangelog = '';
      
      if (fs.existsSync(changelogPath)) {
        existingChangelog = fs.readFileSync(changelogPath, 'utf8');
      }
      
      const newChangelog = changelog + '\n' + existingChangelog;
      fs.writeFileSync(changelogPath, newChangelog);
      
      console.log(`✅ Generated changelog for version ${version}`);
      return changelog;
    } catch (error) {
      console.warn('Could not generate changelog:', error.message);
      return null;
    }
  }

  createGitTag(version) {
    try {
      execSync(`git add .`);
      execSync(`git commit -m "chore: bump version to ${version}"`);
      execSync(`git tag -a v${version} -m "Release version ${version}"`);
      console.log(`✅ Created git tag v${version}`);
      return true;
    } catch (error) {
      console.error('Failed to create git tag:', error.message);
      return false;
    }
  }

  validateVersion(version) {
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)$/;
    return semverRegex.test(version);
  }
}

// CLI Interface
if (require.main === module) {
  const versionManager = new VersionManager();
  const args = process.argv.slice(2);
  const command = args[0];
  const versionType = args[1] || 'patch';

  switch (command) {
    case 'current':
      console.log(`Current version: ${versionManager.getCurrentVersion()}`);
      break;
      
    case 'increment':
      const newVersion = versionManager.incrementVersion(versionType);
      versionManager.generateChangelog(newVersion);
      versionManager.createGitTag(newVersion);
      break;
      
    case 'set':
      const targetVersion = args[1];
      if (!targetVersion || !versionManager.validateVersion(targetVersion)) {
        console.error('Please provide a valid semantic version (e.g., 1.2.3)');
        process.exit(1);
      }
      versionManager.updateAllVersions(targetVersion);
      versionManager.generateChangelog(targetVersion);
      versionManager.createGitTag(targetVersion);
      break;
      
    default:
      console.log(`
Usage: node version-manager.js <command> [options]

Commands:
  current                 Show current version
  increment [type]        Increment version (patch|minor|major)
  set <version>          Set specific version

Examples:
  node version-manager.js current
  node version-manager.js increment patch
  node version-manager.js increment minor
  node version-manager.js set 2.0.0
      `);
  }
}

module.exports = VersionManager;
```

## Release Orchestration

### Release Coordinator Service

```javascript
// release-coordinator.js
const { WebClient } = require('@slack/web-api');
const { Octokit } = require('@octokit/rest');
const { GoogleAuth } = require('google-auth-library');

class ReleaseCoordinator {
  constructor(config) {
    this.config = config;
    this.slack = new WebClient(config.slackToken);
    this.github = new Octokit({ auth: config.githubToken });
    this.playStoreAuth = new GoogleAuth({
      keyFile: config.googleServiceAccountPath,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
  }

  async orchestrateRelease(version, releaseType = 'patch') {
    const releaseId = `release-${version}-${Date.now()}`;
    
    try {
      await this.notifyReleaseStart(releaseId, version, releaseType);
      
      // Step 1: Create release branch
      await this.createReleaseBranch(version);
      
      // Step 2: Run automated tests
      const testResults = await this.runAutomatedTests();
      if (!testResults.success) {
        throw new Error(`Tests failed: ${testResults.errors.join(', ')}`);
      }
      
      // Step 3: Build and distribute to internal testers
      await this.buildAndDistribute(version, 'internal');
      
      // Step 4: Wait for QA approval
      const qaApproval = await this.waitForQAApproval(releaseId);
      if (!qaApproval) {
        throw new Error('QA approval not received');
      }
      
      // Step 5: Deploy to stores
      await this.deployToStores(version);
      
      // Step 6: Monitor deployment
      await this.monitorDeployment(version);
      
      await this.notifyReleaseSuccess(releaseId, version);
      
    } catch (error) {
      await this.notifyReleaseError(releaseId, version, error);
      throw error;
    }
  }

  async createReleaseBranch(version) {
    const { data: mainBranch } = await this.github.rest.repos.getBranch({
      owner: this.config.repoOwner,
      repo: this.config.repoName,
      branch: 'main',
    });

    await this.github.rest.git.createRef({
      owner: this.config.repoOwner,
      repo: this.config.repoName,
      ref: `refs/heads/release/${version}`,
      sha: mainBranch.commit.sha,
    });

    console.log(`✅ Created release branch: release/${version}`);
  }

  async runAutomatedTests() {
    // Trigger GitHub Actions workflow for testing
    const { data: workflow } = await this.github.rest.actions.createWorkflowDispatch({
      owner: this.config.repoOwner,
      repo: this.config.repoName,
      workflow_id: 'test.yml',
      ref: 'main',
    });

    // Poll for completion
    return await this.pollWorkflowCompletion(workflow.id);
  }

  async buildAndDistribute(version, track = 'internal') {
    const builds = await Promise.all([
      this.buildAndroid(version, track),
      this.buildiOS(version, track),
    ]);

    return builds;
  }

  async buildAndroid(version, track) {
    // Trigger Android build workflow
    const { data: workflow } = await this.github.rest.actions.createWorkflowDispatch({
      owner: this.config.repoOwner,
      repo: this.config.repoName,
      workflow_id: 'android-build.yml',
      ref: `release/${version}`,
      inputs: {
        version,
        track,
      },
    });

    return await this.pollWorkflowCompletion(workflow.id);
  }

  async buildiOS(version, track) {
    // Trigger iOS build workflow
    const { data: workflow } = await this.github.rest.actions.createWorkflowDispatch({
      owner: this.config.repoOwner,
      repo: this.config.repoName,
      workflow_id: 'ios-build.yml',
      ref: `release/${version}`,
      inputs: {
        version,
        track,
      },
    });

    return await this.pollWorkflowCompletion(workflow.id);
  }

  async waitForQAApproval(releaseId, timeout = 24 * 60 * 60 * 1000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkApproval = async () => {
        if (Date.now() - startTime > timeout) {
          resolve(false);
          return;
        }

        // Check approval status (implement your approval mechanism)
        const approved = await this.checkApprovalStatus(releaseId);
        
        if (approved) {
          resolve(true);
        } else {
          setTimeout(checkApproval, 5 * 60 * 1000); // Check every 5 minutes
        }
      };

      checkApproval();
    });
  }

  async deployToStores(version) {
    const deployments = await Promise.all([
      this.deployToPlayStore(version),
      this.deployToAppStore(version),
    ]);

    return deployments;
  }

  async deployToPlayStore(version) {
    // Use Google Play Developer API to promote internal track to production
    const auth = await this.playStoreAuth.getClient();
    
    // Implementation would involve calling Play Developer API
    console.log(`🤖 Deploying Android version ${version} to Play Store`);
    
    return { platform: 'android', version, status: 'deployed' };
  }

  async deployToAppStore(version) {
    // Use App Store Connect API to submit for review
    console.log(`📱 Deploying iOS version ${version} to App Store`);
    
    return { platform: 'ios', version, status: 'submitted' };
  }

  async monitorDeployment(version) {
    // Monitor app store rollout status
    console.log(`👀 Monitoring deployment of version ${version}`);
    
    // Check for crashes, user feedback, performance metrics
    await this.monitorCrashReports(version);
    await this.monitorUserFeedback(version);
    await this.monitorPerformanceMetrics(version);
  }

  async notifyReleaseStart(releaseId, version, releaseType) {
    await this.slack.chat.postMessage({
      channel: this.config.slackChannel,
      text: `🚀 Starting ${releaseType} release ${version}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'markdown',
            text: `*Release Started* 🚀\n\n*Version:* ${version}\n*Type:* ${releaseType}\n*Release ID:* ${releaseId}`
          }
        }
      ]
    });
  }

  async notifyReleaseSuccess(releaseId, version) {
    await this.slack.chat.postMessage({
      channel: this.config.slackChannel,
      text: `✅ Release ${version} completed successfully!`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'markdown',
            text: `*Release Completed* ✅\n\n*Version:* ${version}\n*Release ID:* ${releaseId}\n\nThe app is now available on both app stores! 🎉`
          }
        }
      ]
    });
  }

  async notifyReleaseError(releaseId, version, error) {
    await this.slack.chat.postMessage({
      channel: this.config.slackChannel,
      text: `❌ Release ${version} failed`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'markdown',
            text: `*Release Failed* ❌\n\n*Version:* ${version}\n*Release ID:* ${releaseId}\n*Error:* ${error.message}`
          }
        }
      ]
    });
  }

  async pollWorkflowCompletion(workflowId, timeout = 30 * 60 * 1000) {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const checkStatus = async () => {
        if (Date.now() - startTime > timeout) {
          resolve({ success: false, error: 'Workflow timeout' });
          return;
        }

        try {
          const { data: workflow } = await this.github.rest.actions.getWorkflowRun({
            owner: this.config.repoOwner,
            repo: this.config.repoName,
            run_id: workflowId,
          });

          if (workflow.status === 'completed') {
            resolve({ 
              success: workflow.conclusion === 'success',
              conclusion: workflow.conclusion 
            });
          } else {
            setTimeout(checkStatus, 30000); // Check every 30 seconds
          }
        } catch (error) {
          resolve({ success: false, error: error.message });
        }
      };

      checkStatus();
    });
  }
}

module.exports = ReleaseCoordinator;
```

## Store Management

### App Store Connect Integration

```javascript
// app-store-manager.js
const jwt = require('jsonwebtoken');
const axios = require('axios');
const fs = require('fs');

class AppStoreManager {
  constructor(config) {
    this.config = config;
    this.baseURL = 'https://api.appstoreconnect.apple.com/v1';
  }

  generateJWT() {
    const privateKey = fs.readFileSync(this.config.privateKeyPath, 'utf8');
    
    const payload = {
      iss: this.config.issuerId,
      exp: Math.floor(Date.now() / 1000) + (20 * 60), // 20 minutes
      aud: 'appstoreconnect-v1',
    };

    return jwt.sign(payload, privateKey, {
      algorithm: 'ES256',
      header: {
        kid: this.config.keyId,
        typ: 'JWT',
      },
    });
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    const token = this.generateJWT();
    
    const response = await axios({
      method,
      url: `${this.baseURL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data,
    });

    return response.data;
  }

  async getApps() {
    const response = await this.makeRequest('/apps');
    return response.data;
  }

  async getAppInfo(appId) {
    const response = await this.makeRequest(`/apps/${appId}`);
    return response.data;
  }

  async getBuilds(appId) {
    const response = await this.makeRequest(`/apps/${appId}/builds`);
    return response.data;
  }

  async createVersion(appId, versionString, platform = 'IOS') {
    const data = {
      type: 'appStoreVersions',
      attributes: {
        platform,
        versionString,
      },
      relationships: {
        app: {
          data: {
            type: 'apps',
            id: appId,
          },
        },
      },
    };

    const response = await this.makeRequest('/appStoreVersions', 'POST', { data });
    return response.data;
  }

  async submitForReview(versionId) {
    const data = {
      type: 'appStoreVersionSubmissions',
      relationships: {
        appStoreVersion: {
          data: {
            type: 'appStoreVersions',
            id: versionId,
          },
        },
      },
    };

    const response = await this.makeRequest('/appStoreVersionSubmissions', 'POST', { data });
    return response.data;
  }

  async getReviewStatus(appId) {
    const response = await this.makeRequest(`/apps/${appId}/appStoreVersions?filter[appStoreState]=PENDING_APPLE_RELEASE,IN_REVIEW,PENDING_DEVELOPER_RELEASE`);
    return response.data;
  }

  async updateMetadata(versionId, metadata) {
    const data = {
      type: 'appStoreVersions',
      id: versionId,
      attributes: metadata,
    };

    const response = await this.makeRequest(`/appStoreVersions/${versionId}`, 'PATCH', { data });
    return response.data;
  }

  async uploadScreenshots(versionId, screenshots) {
    // Implementation for screenshot upload would go here
    // This involves creating screenshot sets and uploading images
    console.log(`Uploading screenshots for version ${versionId}`);
  }

  async monitorReviewStatus(appId, callback) {
    const checkStatus = async () => {
      try {
        const status = await this.getReviewStatus(appId);
        callback(null, status);
      } catch (error) {
        callback(error, null);
      }
    };

    // Check every 10 minutes
    const interval = setInterval(checkStatus, 10 * 60 * 1000);
    checkStatus(); // Initial check

    return interval;
  }
}

module.exports = AppStoreManager;
```

### Google Play Console Integration

```javascript
// play-store-manager.js
const { google } = require('googleapis');
const fs = require('fs');

class PlayStoreManager {
  constructor(config) {
    this.config = config;
    this.auth = new google.auth.GoogleAuth({
      keyFile: config.serviceAccountPath,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });
    this.androidpublisher = google.androidpublisher('v3');
  }

  async getAuthClient() {
    if (!this.authClient) {
      this.authClient = await this.auth.getClient();
    }
    return this.authClient;
  }

  async createEdit(packageName) {
    const auth = await this.getAuthClient();
    
    const response = await this.androidpublisher.edits.insert({
      auth,
      packageName,
    });

    return response.data.id;
  }

  async commitEdit(packageName, editId) {
    const auth = await this.getAuthClient();
    
    await this.androidpublisher.edits.commit({
      auth,
      packageName,
      editId,
    });
  }

  async uploadBundle(packageName, editId, bundlePath) {
    const auth = await this.getAuthClient();
    
    const response = await this.androidpublisher.edits.bundles.upload({
      auth,
      packageName,
      editId,
      media: {
        mimeType: 'application/octet-stream',
        body: fs.createReadStream(bundlePath),
      },
    });

    return response.data.versionCode;
  }

  async updateTrack(packageName, editId, track, versionCodes, releaseStatus = 'completed') {
    const auth = await this.getAuthClient();
    
    await this.androidpublisher.edits.tracks.update({
      auth,
      packageName,
      editId,
      track,
      requestBody: {
        releases: [{
          versionCodes: versionCodes.map(String),
          status: releaseStatus,
        }],
      },
    });
  }

  async getTrackInfo(packageName, track) {
    const auth = await this.getAuthClient();
    
    const response = await this.androidpublisher.edits.tracks.get({
      auth,
      packageName,
      track,
    });

    return response.data;
  }

  async promoteRelease(packageName, fromTrack, toTrack, versionCodes) {
    const editId = await this.createEdit(packageName);
    
    try {
      await this.updateTrack(packageName, editId, toTrack, versionCodes);
      await this.commitEdit(packageName, editId);
      console.log(`✅ Promoted release from ${fromTrack} to ${toTrack}`);
    } catch (error) {
      console.error(`❌ Failed to promote release: ${error.message}`);
      throw error;
    }
  }

  async getRolloutInfo(packageName, track) {
    const auth = await this.getAuthClient();
    
    const response = await this.androidpublisher.edits.tracks.get({
      auth,
      packageName,
      track,
    });

    const release = response.data.releases?.[0];
    return {
      status: release?.status,
      userFraction: release?.userFraction,
      versionCodes: release?.versionCodes,
    };
  }

  async updateRolloutPercentage(packageName, track, versionCodes, userFraction) {
    const editId = await this.createEdit(packageName);
    
    try {
      const auth = await this.getAuthClient();
      
      await this.androidpublisher.edits.tracks.update({
        auth,
        packageName,
        editId,
        track,
        requestBody: {
          releases: [{
            versionCodes: versionCodes.map(String),
            status: 'inProgress',
            userFraction,
          }],
        },
      });

      await this.commitEdit(packageName, editId);
      console.log(`✅ Updated rollout to ${userFraction * 100}%`);
    } catch (error) {
      console.error(`❌ Failed to update rollout: ${error.message}`);
      throw error;
    }
  }

  async haltRollout(packageName, track, versionCodes) {
    const editId = await this.createEdit(packageName);
    
    try {
      const auth = await this.getAuthClient();
      
      await this.androidpublisher.edits.tracks.update({
        auth,
        packageName,
        editId,
        track,
        requestBody: {
          releases: [{
            versionCodes: versionCodes.map(String),
            status: 'halted',
          }],
        },
      });

      await this.commitEdit(packageName, editId);
      console.log(`🛑 Halted rollout for track ${track}`);
    } catch (error) {
      console.error(`❌ Failed to halt rollout: ${error.message}`);
      throw error;
    }
  }
}

module.exports = PlayStoreManager;
```

## Release Monitoring

### Release Health Monitor

```javascript
// release-monitor.js
const axios = require('axios');

class ReleaseHealthMonitor {
  constructor(config) {
    this.config = config;
    this.metrics = {
      crashRate: 0,
      anrRate: 0,
      adoptionRate: 0,
      userRating: 0,
      performanceMetrics: {},
    };
  }

  async startMonitoring(version, duration = 24 * 60 * 60 * 1000) {
    console.log(`🔍 Starting health monitoring for version ${version}`);
    
    const monitoringTasks = [
      this.monitorCrashRates(version),
      this.monitorAdoptionRate(version),
      this.monitorUserFeedback(version),
      this.monitorPerformanceMetrics(version),
    ];

    // Set up periodic checks
    const interval = setInterval(async () => {
      await Promise.all(monitoringTasks.map(task => task.catch(console.error)));
      await this.evaluateReleaseHealth(version);
    }, 5 * 60 * 1000); // Check every 5 minutes

    // Stop monitoring after specified duration
    setTimeout(() => {
      clearInterval(interval);
      console.log(`✅ Completed health monitoring for version ${version}`);
    }, duration);

    return interval;
  }

  async monitorCrashRates(version) {
    try {
      // Firebase Crashlytics API call
      const response = await axios.get(
        `https://crashlytics.googleapis.com/v1beta/apps/${this.config.firebaseAppId}/crashlytics/versions/${version}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.firebaseToken}`,
          },
        }
      );

      const crashData = response.data;
      this.metrics.crashRate = crashData.crashRate || 0;
      this.metrics.anrRate = crashData.anrRate || 0;

      if (this.metrics.crashRate > this.config.thresholds.maxCrashRate) {
        await this.triggerAlert('HIGH_CRASH_RATE', {
          version,
          crashRate: this.metrics.crashRate,
        });
      }
    } catch (error) {
      console.error('Error monitoring crash rates:', error.message);
    }
  }

  async monitorAdoptionRate(version) {
    try {
      // Google Analytics or custom analytics API
      const response = await axios.get(
        `${this.config.analyticsEndpoint}/adoption-rate`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.analyticsToken}`,
          },
          params: {
            version,
            timeframe: '24h',
          },
        }
      );

      this.metrics.adoptionRate = response.data.adoptionRate;

      if (this.metrics.adoptionRate < this.config.thresholds.minAdoptionRate) {
        await this.triggerAlert('LOW_ADOPTION_RATE', {
          version,
          adoptionRate: this.metrics.adoptionRate,
        });
      }
    } catch (error) {
      console.error('Error monitoring adoption rate:', error.message);
    }
  }

  async monitorUserFeedback(version) {
    try {
      // App Store and Play Store API calls to get reviews
      const [iosReviews, androidReviews] = await Promise.all([
        this.getiOSReviews(version),
        this.getAndroidReviews(version),
      ]);

      const allReviews = [...iosReviews, ...androidReviews];
      const averageRating = allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length;
      
      this.metrics.userRating = averageRating;

      if (averageRating < this.config.thresholds.minUserRating) {
        await this.triggerAlert('LOW_USER_RATING', {
          version,
          rating: averageRating,
          reviewCount: allReviews.length,
        });
      }
    } catch (error) {
      console.error('Error monitoring user feedback:', error.message);
    }
  }

  async monitorPerformanceMetrics(version) {
    try {
      // Firebase Performance Monitoring API
      const response = await axios.get(
        `${this.config.performanceEndpoint}/metrics`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.firebaseToken}`,
          },
          params: {
            version,
            metrics: 'app_start_time,screen_rendering,network_requests',
          },
        }
      );

      this.metrics.performanceMetrics = response.data;

      // Check performance regressions
      const appStartTime = this.metrics.performanceMetrics.app_start_time;
      if (appStartTime > this.config.thresholds.maxAppStartTime) {
        await this.triggerAlert('PERFORMANCE_REGRESSION', {
          version,
          metric: 'app_start_time',
          value: appStartTime,
        });
      }
    } catch (error) {
      console.error('Error monitoring performance metrics:', error.message);
    }
  }

  async evaluateReleaseHealth(version) {
    const healthScore = this.calculateHealthScore();
    
    console.log(`📊 Release Health Score for ${version}: ${healthScore}/100`);
    
    if (healthScore < this.config.thresholds.minHealthScore) {
      await this.triggerAlert('POOR_RELEASE_HEALTH', {
        version,
        healthScore,
        metrics: this.metrics,
      });
      
      // Consider automatic rollback
      if (healthScore < this.config.thresholds.rollbackThreshold) {
        await this.initiateRollback(version);
      }
    }
  }

  calculateHealthScore() {
    const weights = {
      crashRate: 30,
      adoptionRate: 25,
      userRating: 25,
      performance: 20,
    };

    const scores = {
      crashRate: Math.max(0, 100 - (this.metrics.crashRate * 1000)), // Assuming crash rate is a decimal
      adoptionRate: Math.min(100, this.metrics.adoptionRate * 100),
      userRating: (this.metrics.userRating / 5) * 100,
      performance: this.calculatePerformanceScore(),
    };

    return Object.keys(weights).reduce((total, metric) => {
      return total + (scores[metric] * weights[metric] / 100);
    }, 0);
  }

  calculatePerformanceScore() {
    // Simplified performance scoring based on app start time
    const appStartTime = this.metrics.performanceMetrics.app_start_time || 1000;
    const maxAcceptableTime = 3000; // 3 seconds
    
    return Math.max(0, 100 - ((appStartTime / maxAcceptableTime) * 100));
  }

  async triggerAlert(alertType, data) {
    const alert = {
      type: alertType,
      timestamp: new Date().toISOString(),
      data,
      severity: this.getAlertSeverity(alertType),
    };

    console.log(`🚨 ALERT: ${alertType}`, alert);

    // Send to Slack, PagerDuty, etc.
    await this.sendSlackAlert(alert);
    
    if (alert.severity === 'critical') {
      await this.sendPagerDutyAlert(alert);
    }
  }

  getAlertSeverity(alertType) {
    const severityMap = {
      HIGH_CRASH_RATE: 'critical',
      LOW_ADOPTION_RATE: 'warning',
      LOW_USER_RATING: 'warning',
      PERFORMANCE_REGRESSION: 'warning',
      POOR_RELEASE_HEALTH: 'critical',
    };

    return severityMap[alertType] || 'info';
  }

  async initiateRollback(version) {
    console.log(`🔄 Initiating automatic rollback for version ${version}`);
    
    // Implementation would involve calling app store APIs to rollback
    // This is a critical operation and should have proper safeguards
    
    await this.triggerAlert('AUTOMATIC_ROLLBACK_INITIATED', {
      version,
      reason: 'Poor release health score',
      healthScore: this.calculateHealthScore(),
    });
  }
}

module.exports = ReleaseHealthMonitor;
```

## Best Practices

### 1. Release Planning
- Define clear release criteria
- Plan rollback strategies
- Set up proper environments
- Document release processes

### 2. Automation
- Automate build and deployment
- Implement automated testing
- Use infrastructure as code
- Set up monitoring and alerting

### 3. Quality Assurance
- Implement staged rollouts
- Monitor key metrics
- Have rollback procedures
- Test on multiple devices/OS versions

### 4. Communication
- Keep stakeholders informed
- Document release notes
- Coordinate across teams
- Maintain release calendar

### 5. Post-Release
- Monitor app performance
- Track user feedback
- Analyze crash reports
- Plan hotfixes if needed

This comprehensive release management system provides enterprise-grade deployment automation, monitoring, and coordination capabilities for mobile applications across both major app stores.
