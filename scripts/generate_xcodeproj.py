#!/usr/bin/env python3
"""Generate a self-contained Xcode project for GC Field Log."""

from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path("/workspace")
APP = ROOT / "GCFieldLog"
PROJ = ROOT / "GCFieldLog.xcodeproj"


def xid(name: str) -> str:
    digest = hashlib.sha1(name.encode()).hexdigest().upper()
    return digest[:24]


swift_files = sorted(p.relative_to(APP) for p in APP.rglob("*.swift"))

project_id = xid("project")
target_id = xid("target")
sources_phase = xid("sources")
resources_phase = xid("resources")
frameworks_phase = xid("frameworks")
main_group = xid("maingroup")
products_group = xid("products")
app_group = xid("appgroup")
product_ref = xid("product")
assets_ref = xid("assets")
assets_build = xid("assets-build")
conf_list_proj = xid("conflist-proj")
conf_list_tgt = xid("conflist-tgt")
debug_proj = xid("debug-proj")
release_proj = xid("release-proj")
debug_tgt = xid("debug-tgt")
release_tgt = xid("release-tgt")

groups: dict[str, str] = {"": app_group}
group_children: dict[str, list[str]] = {"": []}

for path in swift_files:
    parent = str(path.parent) if path.parent != Path(".") else ""
    parts = [] if parent == "" else parent.split("/")
    acc = ""
    prev = ""
    for part in parts:
        acc = part if acc == "" else f"{acc}/{part}"
        if acc not in groups:
            groups[acc] = xid(f"group:{acc}")
            group_children[acc] = []
            group_children[prev].append(f"\t\t\t\t{groups[acc]} /* {part} */,\n")
        prev = acc

file_refs: list[str] = []
build_files: list[str] = []
source_entries: list[str] = []

for path in swift_files:
    name = path.name
    rel = str(path)
    ref = xid(f"ref:{rel}")
    build = xid(f"build:{rel}")
    parent = str(path.parent) if path.parent != Path(".") else ""
    file_refs.append(
        f"\t\t{ref} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {name}; sourceTree = \"<group>\"; }};\n"
    )
    build_files.append(
        f"\t\t{build} /* {name} in Sources */ = {{isa = PBXBuildFile; fileRef = {ref} /* {name} */; }};\n"
    )
    source_entries.append(f"\t\t\t\t{build} /* {name} in Sources */,\n")
    group_children[parent].append(f"\t\t\t\t{ref} /* {name} */,\n")

file_refs.append(
    f"\t\t{assets_ref} /* Assets.xcassets */ = {{isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = \"<group>\"; }};\n"
)
file_refs.append(
    f"\t\t{product_ref} /* GCFieldLog.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = GCFieldLog.app; sourceTree = BUILT_PRODUCTS_DIR; }};\n"
)
build_files.append(
    f"\t\t{assets_build} /* Assets.xcassets in Resources */ = {{isa = PBXBuildFile; fileRef = {assets_ref} /* Assets.xcassets */; }};\n"
)
group_children[""].append(f"\t\t\t\t{assets_ref} /* Assets.xcassets */,\n")

group_blocks = []
for folder, gid in sorted(groups.items(), key=lambda kv: kv[0]):
    name = folder.split("/")[-1] if folder else "GCFieldLog"
    path_line = f"\t\t\tpath = {name};\n"
    children = "".join(group_children[folder])
    group_blocks.append(
        f"\t\t{gid} /* {name} */ = {{\n"
        f"\t\t\tisa = PBXGroup;\n"
        f"\t\t\tchildren = (\n"
        f"{children}"
        f"\t\t\t);\n"
        f"{path_line}"
        f"\t\t\tsourceTree = \"<group>\";\n"
        f"\t\t}};\n"
    )

common_target = """
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = "";
				ENABLE_PREVIEWS = YES;
				GENERATE_INFOPLIST_FILE = YES;
				INFOPLIST_KEY_CFBundleDisplayName = "GC Field Log";
				INFOPLIST_KEY_LSApplicationCategoryType = "public.app-category.business";
				INFOPLIST_KEY_NSCameraUsageDescription = "Snap packing slips, paper sign-in sheets, and field photos.";
				INFOPLIST_KEY_NSLocalNetworkUsageDescription = "Bump work to a nearby device running GC Field Log. Not system AirDrop.";
				INFOPLIST_KEY_NSPhotoLibraryUsageDescription = "Attach photos to RFI packets and field problems.";
				INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;
				INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;
				INFOPLIST_KEY_UILaunchScreen_Generation = YES;
				INFOPLIST_KEY_UISupportedInterfaceOrientations = "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
				INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = com.gcfieldlog.app;
				PRODUCT_NAME = "$(TARGET_NAME)";
				SUPPORTED_PLATFORMS = "iphoneos iphonesimulator";
				SUPPORTS_MACCATALYST = NO;
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_STRICT_CONCURRENCY = targeted;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
"""

pbx = f"""// !$*UTF8*$!
{{
	archiveVersion = 1;
	classes = {{
	}};
	objectVersion = 56;
	objects = {{

/* Begin PBXBuildFile section */
{''.join(build_files)}/* End PBXBuildFile section */

/* Begin PBXFileReference section */
{''.join(file_refs)}/* End PBXFileReference section */

/* Begin PBXFrameworksBuildPhase section */
		{frameworks_phase} /* Frameworks */ = {{
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		}};
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
		{main_group} = {{
			isa = PBXGroup;
			children = (
				{app_group} /* GCFieldLog */,
				{products_group} /* Products */,
			);
			sourceTree = "<group>";
		}};
		{products_group} /* Products */ = {{
			isa = PBXGroup;
			children = (
				{product_ref} /* GCFieldLog.app */,
			);
			name = Products;
			sourceTree = "<group>";
		}};
{''.join(group_blocks)}/* End PBXGroup section */

/* Begin PBXNativeTarget section */
		{target_id} /* GCFieldLog */ = {{
			isa = PBXNativeTarget;
			buildConfigurationList = {conf_list_tgt} /* Build configuration list for PBXNativeTarget "GCFieldLog" */;
			buildPhases = (
				{sources_phase} /* Sources */,
				{frameworks_phase} /* Frameworks */,
				{resources_phase} /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
			);
			name = GCFieldLog;
			productName = GCFieldLog;
			productReference = {product_ref} /* GCFieldLog.app */;
			productType = "com.apple.product-type.application";
		}};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
		{project_id} /* Project object */ = {{
			isa = PBXProject;
			attributes = {{
				BuildIndependentTargetsInParallel = 1;
				LastSwiftUpdateCheck = 1600;
				LastUpgradeCheck = 1600;
				TargetAttributes = {{
					{target_id} = {{
						CreatedOnToolsVersion = 16.0;
					}};
				}};
			}};
			buildConfigurationList = {conf_list_proj} /* Build configuration list for PBXProject "GCFieldLog" */;
			compatibilityVersion = "Xcode 14.0";
			developmentRegion = en;
			hasScannedForEncodings = 0;
			knownRegions = (
				en,
				Base,
			);
			mainGroup = {main_group};
			productRefGroup = {products_group} /* Products */;
			projectDirPath = "";
			projectRoot = "";
			targets = (
				{target_id} /* GCFieldLog */,
			);
		}};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
		{resources_phase} /* Resources */ = {{
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				{assets_build} /* Assets.xcassets in Resources */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		}};
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
		{sources_phase} /* Sources */ = {{
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
{''.join(source_entries)}\t\t\t);
			runOnlyForDeploymentPostprocessing = 0;
		}};
/* End PBXSourcesBuildPhase section */

/* Begin XCBuildConfiguration section */
		{debug_proj} /* Debug */ = {{
			isa = XCBuildConfiguration;
			buildSettings = {{
				ALWAYS_SEARCH_USER_PATHS = NO;
				ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS = YES;
				CLANG_ENABLE_MODULES = YES;
				CLANG_ENABLE_OBJC_ARC = YES;
				COPY_PHASE_STRIP = NO;
				DEBUG_INFORMATION_FORMAT = dwarf;
				ENABLE_TESTABILITY = YES;
				ENABLE_USER_SCRIPT_SANDBOXING = YES;
				GCC_DYNAMIC_NO_PIC = NO;
				GCC_OPTIMIZATION_LEVEL = 0;
				IPHONEOS_DEPLOYMENT_TARGET = 18.0;
				MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
				ONLY_ACTIVE_ARCH = YES;
				SDKROOT = iphoneos;
				SWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG $(inherited)";
				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
			}};
			name = Debug;
		}};
		{release_proj} /* Release */ = {{
			isa = XCBuildConfiguration;
			buildSettings = {{
				ALWAYS_SEARCH_USER_PATHS = NO;
				ASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS = YES;
				CLANG_ENABLE_MODULES = YES;
				CLANG_ENABLE_OBJC_ARC = YES;
				COPY_PHASE_STRIP = NO;
				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
				ENABLE_NS_ASSERTIONS = NO;
				ENABLE_USER_SCRIPT_SANDBOXING = YES;
				IPHONEOS_DEPLOYMENT_TARGET = 18.0;
				SDKROOT = iphoneos;
				SWIFT_COMPILATION_MODE = wholemodule;
				VALIDATE_PRODUCT = YES;
			}};
			name = Release;
		}};
		{debug_tgt} /* Debug */ = {{
			isa = XCBuildConfiguration;
			buildSettings = {{{common_target}			}};
			name = Debug;
		}};
		{release_tgt} /* Release */ = {{
			isa = XCBuildConfiguration;
			buildSettings = {{{common_target}			}};
			name = Release;
		}};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
		{conf_list_proj} /* Build configuration list for PBXProject "GCFieldLog" */ = {{
			isa = XCConfigurationList;
			buildConfigurations = (
				{debug_proj} /* Debug */,
				{release_proj} /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		}};
		{conf_list_tgt} /* Build configuration list for PBXNativeTarget "GCFieldLog" */ = {{
			isa = XCConfigurationList;
			buildConfigurations = (
				{debug_tgt} /* Debug */,
				{release_tgt} /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		}};
/* End XCConfigurationList section */
	}};
	rootObject = {project_id} /* Project object */;
}}
"""

PROJ.mkdir(exist_ok=True)
(PROJ / "project.pbxproj").write_text(pbx)
scheme_dir = PROJ / "xcshareddata" / "xcschemes"
scheme_dir.mkdir(parents=True, exist_ok=True)
(scheme_dir / "GCFieldLog.xcscheme").write_text(
    f"""<?xml version="1.0" encoding="UTF-8"?>
<Scheme
   LastUpgradeVersion = "1600"
   version = "1.7">
   <BuildAction
      parallelizeBuildables = "YES"
      buildImplicitDependencies = "YES">
      <BuildActionEntries>
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "{target_id}"
               BuildableName = "GCFieldLog.app"
               BlueprintName = "GCFieldLog"
               ReferencedContainer = "container:GCFieldLog.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>
      </BuildActionEntries>
   </BuildAction>
   <TestAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      shouldUseLaunchSchemeArgsEnv = "YES"
      shouldAutocreateTestPlan = "YES">
   </TestAction>
   <LaunchAction
      buildConfiguration = "Debug"
      selectedDebuggerIdentifier = "Xcode.DebuggerFoundation.Debugger.LLDB"
      selectedLauncherIdentifier = "Xcode.DebuggerFoundation.Launcher.LLDB"
      launchStyle = "0"
      useCustomWorkingDirectory = "NO"
      ignoresPersistentStateOnLaunch = "NO"
      debugDocumentVersioning = "YES"
      debugServiceExtension = "internal"
      allowLocationSimulation = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{target_id}"
            BuildableName = "GCFieldLog.app"
            BlueprintName = "GCFieldLog"
            ReferencedContainer = "container:GCFieldLog.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </LaunchAction>
   <ProfileAction
      buildConfiguration = "Release"
      shouldUseLaunchSchemeArgsEnv = "YES"
      savedToolIdentifier = ""
      useCustomWorkingDirectory = "NO"
      debugDocumentVersioning = "YES">
      <BuildableProductRunnable
         runnableDebuggingMode = "0">
         <BuildableReference
            BuildableIdentifier = "primary"
            BlueprintIdentifier = "{target_id}"
            BuildableName = "GCFieldLog.app"
            BlueprintName = "GCFieldLog"
            ReferencedContainer = "container:GCFieldLog.xcodeproj">
         </BuildableReference>
      </BuildableProductRunnable>
   </ProfileAction>
   <AnalyzeAction
      buildConfiguration = "Debug">
   </AnalyzeAction>
   <ArchiveAction
      buildConfiguration = "Release"
      revealArchiveInOrganizer = "YES">
   </ArchiveAction>
</Scheme>
"""
)
print(f"wrote project with {len(swift_files)} swift files")
