# Confluence Publish Roundtrip Test
# This script tests the full roundtrip of fetching and re-publishing confluence content

$ErrorActionPreference = "Stop";

# Change to the tests/fetch directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path;
Set-Location -Path "$scriptPath";
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Cyan;

Write-Host "Starting Confluence publish roundtrip test..." -ForegroundColor Green;

# Step 1: Remove existing content
Write-Host "Removing existing content directory and config file..." -ForegroundColor Cyan;
if (Test-Path "content" -PathType Container) {
    Remove-Item -Path "content" -Recurse -Force;
}
if (Test-Path "publish-confluence.json" -PathType Leaf) {
    Remove-Item -Path "publish-confluence.json" -Force;
}

# Step 2: Execute fetch command to recreate files
Write-Host "Fetching content from Confluence..." -ForegroundColor Cyan;
node "..\..\dist\cli.js" fetch -s ~thro -p Testing --process handlebars;

# Verify files were created
if (-not (Test-Path "publish-confluence.json" -PathType Leaf)) {
    Write-Host "Error: publish-confluence.json was not created by fetch command." -ForegroundColor Red;
    exit 1;
}
if (-not (Test-Path "content" -PathType Container)) {
    Write-Host "Error: content directory was not created by fetch command." -ForegroundColor Red;
    exit 1;
}

# Step 3: Modify the publish-confluence.json file to append "- roundtrip" to pageTitle
Write-Host "Modifying publish-confluence.json..." -ForegroundColor Cyan;
$configFile = Get-Content -Path "publish-confluence.json" -Raw | ConvertFrom-Json;
$originalTitle = $configFile.pageTitle;
$configFile.pageTitle = "$originalTitle - roundtrip";
$configFile | ConvertTo-Json -Depth 10 | Set-Content -Path "publish-confluence.json";

# Verify modification
$modifiedConfig = Get-Content -Path "publish-confluence.json" -Raw | ConvertFrom-Json;
if ($modifiedConfig.pageTitle -ne "$originalTitle - roundtrip") {
    Write-Host "Error: Failed to modify pageTitle in publish-confluence.json." -ForegroundColor Red;
    exit 1;
}
Write-Host "Modified pageTitle to: $($modifiedConfig.pageTitle)" -ForegroundColor Green;

# Step 4: Re-publish with modified title
Write-Host "Re-publishing to Confluence with modified title..." -ForegroundColor Cyan;
node "..\..\dist\cli.js";

Write-Host "Roundtrip testing completed successfully!" -ForegroundColor Green;
