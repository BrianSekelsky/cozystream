APP_NAME     = CozyStream
BUNDLE       = build/$(APP_NAME).app
CONTENTS     = $(BUNDLE)/Contents
MACOS        = $(CONTENTS)/MacOS
RESOURCES    = $(CONTENTS)/Resources
SWIFT_FLAGS  = -O -whole-module-optimization
PROJECT_ROOT = ..

# Path to the Node.js binary to bundle. Override with: make package NODE_BIN=/path/to/node
NODE_BIN    ?= $(shell which node)

.PHONY: build bundle package dmg clean

build:
	@echo "==> Compiling Swift binary..."
	@mkdir -p build
	swiftc $(SWIFT_FLAGS) CozyStream.swift -o build/$(APP_NAME)
	@ls -lh build/$(APP_NAME)

bundle: build
	@echo "==> Creating app bundle..."
	@rm -rf $(BUNDLE)
	@mkdir -p $(MACOS) $(RESOURCES)
	cp build/$(APP_NAME) $(MACOS)/$(APP_NAME)
	cp Info.plist $(CONTENTS)/Info.plist
	@# Copy icons (ignore errors if not found)
	-cp $(PROJECT_ROOT)/assets/icon.icns $(RESOURCES)/icon.icns 2>/dev/null
	-cp $(PROJECT_ROOT)/assets/tray-iconTemplate.png $(RESOURCES)/tray-iconTemplate.png 2>/dev/null
	-cp $(PROJECT_ROOT)/assets/tray-iconTemplate@2x.png $(RESOURCES)/tray-iconTemplate@2x.png 2>/dev/null
	@echo "==> Bundle created at $(BUNDLE)"
	@du -sh $(BUNDLE)

package: bundle
	@echo "==> Packaging with server and Node.js runtime..."
	@# Copy server dist (JS bundle + external node_modules)
	@mkdir -p $(RESOURCES)/server
	cp -R $(PROJECT_ROOT)/server/dist $(RESOURCES)/server/dist
	@# Copy Angular frontend build
	cp -R $(PROJECT_ROOT)/dist/cozystream-angular/browser $(RESOURCES)/browser
	@# Copy and strip Node.js binary
	@if [ -n "$(NODE_BIN)" ] && [ -f "$(NODE_BIN)" ]; then \
		echo "==> Copying Node.js from $(NODE_BIN)..."; \
		cp "$(NODE_BIN)" $(RESOURCES)/node; \
		chmod u+wx $(RESOURCES)/node; \
		strip -x $(RESOURCES)/node 2>/dev/null || true; \
		codesign --force --sign - $(RESOURCES)/node 2>/dev/null || true; \
		echo "    Node.js binary: $$(du -sh $(RESOURCES)/node | cut -f1)"; \
	else \
		echo "WARNING: Node.js binary not found. Set NODE_BIN=/path/to/node"; \
	fi
	@# Strip cross-platform binaries from ffprobe-static
	@echo "==> Stripping cross-platform binaries..."
	@FFPROBE_BIN=$(RESOURCES)/server/dist/node_modules/ffprobe-static/bin; \
	if [ -d "$$FFPROBE_BIN" ]; then \
		for dir in $$FFPROBE_BIN/*/; do \
			platform=$$(basename "$$dir"); \
			if [ "$$platform" != "darwin" ]; then \
				rm -rf "$$dir"; \
				echo "    Removed ffprobe-static/bin/$$platform"; \
			fi; \
		done; \
		ARCH=$$(uname -m); \
		if [ "$$ARCH" = "arm64" ]; then KEEP_ARCH="arm64"; else KEEP_ARCH="x64"; fi; \
		if [ -d "$$FFPROBE_BIN/darwin" ]; then \
			for dir in $$FFPROBE_BIN/darwin/*/; do \
				arch=$$(basename "$$dir"); \
				if [ "$$arch" != "$$KEEP_ARCH" ]; then \
					rm -rf "$$dir"; \
					echo "    Removed ffprobe-static/bin/darwin/$$arch"; \
				fi; \
			done; \
		fi; \
	fi
	@# Strip ffmpeg-static build artifacts
	@FFMPEG_PKG=$(RESOURCES)/server/dist/node_modules/ffmpeg-static; \
	if [ -d "$$FFMPEG_PKG" ]; then \
		rm -rf "$$FFMPEG_PKG/bin" "$$FFMPEG_PKG/scripts" "$$FFMPEG_PKG/test" 2>/dev/null; \
	fi
	@# Remove .d.ts and .map files from node_modules
	@find $(RESOURCES)/server/dist/node_modules -name '*.d.ts' -delete 2>/dev/null || true
	@find $(RESOURCES)/server/dist/node_modules -name '*.map' -delete 2>/dev/null || true
	@echo "==> Package complete"
	@du -sh $(BUNDLE)

dmg: package
	@echo "==> Creating DMG..."
	@rm -f build/$(APP_NAME).dmg
	hdiutil create -volname "$(APP_NAME)" -srcfolder $(BUNDLE) \
		-ov -format UDZO build/$(APP_NAME).dmg
	@echo "==> DMG created"
	@ls -lh build/$(APP_NAME).dmg

clean:
	rm -rf build
