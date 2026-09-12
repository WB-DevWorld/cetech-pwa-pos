PHP ?= php
PLUGIN_DIR := $(dir $(lastword $(MAKEFILE_LIST)))
ROOT := $(abspath $(PLUGIN_DIR)/../..)
# Paths relative to PLUGIN_DIR so GNU Make does not split on spaces in ROOT.
TEST_DIR := $(PLUGIN_DIR)../../tests/bridge

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
	$(TEST_DIR)/run.php \
	$(TEST_DIR)/bootstrap.php \
	$(TEST_DIR)/test-health.php

.PHONY: check test

check:
	@command -v $(PHP) >/dev/null 2>&1 || { echo "BLOCKED: php is not available"; exit 2; }
	@status=0; \
	$(foreach f,$(PHP_SOURCES),$(PHP) -l "$(PLUGIN_DIR)$(f)" || status=1; ) \
	$(foreach f,$(TEST_SOURCES),$(PHP) -l "$(f)" || status=1; ) \
	exit $$status

test:
	@command -v $(PHP) >/dev/null 2>&1 || { echo "BLOCKED: php is not available"; exit 2; }
	$(PHP) "$(ROOT)/tests/bridge/run.php"
