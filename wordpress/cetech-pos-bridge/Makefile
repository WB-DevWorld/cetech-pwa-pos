PHP ?= php
PLUGIN_DIR := $(dir $(lastword $(MAKEFILE_LIST)))
ROOT := $(abspath $(PLUGIN_DIR)/../..)

PHP_SOURCES := \
	cetech-pos-bridge.php \
	includes/class-constants.php \
	includes/class-environment.php \
	includes/class-auth.php \
	includes/class-correlation.php \
	includes/class-detector.php \
	includes/class-response.php \
	includes/class-health-controller.php \
	includes/class-plugin.php

TEST_SOURCES := \
	$(ROOT)/tests/bridge/run.php \
	$(ROOT)/tests/bridge/bootstrap.php \
	$(ROOT)/tests/bridge/test-health.php

.PHONY: check test

check:
	@command -v $(PHP) >/dev/null 2>&1 || { echo "BLOCKED: php is not available"; exit 2; }
	@status=0; \
	for f in $(PHP_SOURCES); do \
		$(PHP) -l "$(PLUGIN_DIR)$$f" || status=1; \
	done; \
	for f in $(TEST_SOURCES); do \
		$(PHP) -l "$$f" || status=1; \
	done; \
	exit $$status

test:
	@command -v $(PHP) >/dev/null 2>&1 || { echo "BLOCKED: php is not available"; exit 2; }
	$(PHP) "$(ROOT)/tests/bridge/run.php"
