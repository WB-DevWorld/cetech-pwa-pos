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
	includes/class-schema.php \
	includes/class-health-controller.php \
	includes/class-money.php \
	includes/class-cart-discount.php \
	includes/class-ephemeral-session.php \
	includes/class-woo-runtime.php \
	includes/class-quote-request.php \
	includes/class-quote-store.php \
	includes/class-quote-engine.php \
	includes/class-quote-controller.php \
	includes/class-request-hash.php \
	includes/class-schema-install.php \
	includes/class-claim-store.php \
	includes/class-command-store.php \
	includes/class-prepare-engine.php \
	includes/class-prepare-controller.php \
	includes/class-resolve-controller.php \
	includes/class-command-engine.php \
	includes/class-finalize-controller.php \
	includes/class-cancel-controller.php \
	includes/class-return-effect-store.php \
	includes/class-return-effect-engine.php \
	includes/class-commercial-refund-controller.php \
	includes/class-stock-disposition-controller.php \
	includes/class-pricing-rules.php \
	includes/class-plugin.php \
	tools/derive-quote-contract.php

TEST_SOURCES := \
	$(TEST_DIR)/run.php \
	$(TEST_DIR)/bootstrap.php \
	$(TEST_DIR)/fake-woo-runtime.php \
	$(TEST_DIR)/test-health.php \
	$(TEST_DIR)/test-quote.php \
	$(TEST_DIR)/test-quote-schema.php \
	$(TEST_DIR)/test-woo-runtime.php \
	$(TEST_DIR)/test-pricing-rules.php \
	$(TEST_DIR)/test-cart-discount.php \
	$(TEST_DIR)/test-prepare.php \
	$(TEST_DIR)/test-finalize-cancel.php \
	$(TEST_DIR)/test-return-effects.php \
	$(TEST_DIR)/test-ws3-generated-return-effects.php \
	$(TEST_DIR)/parity.php

.PHONY: check test parity

check:
	@command -v $(PHP) >/dev/null 2>&1 || { echo "BLOCKED: php is not available"; exit 2; }
	@status=0; \
	$(foreach f,$(PHP_SOURCES),$(PHP) -l "$(PLUGIN_DIR)$(f)" || status=1; ) \
	$(foreach f,$(TEST_SOURCES),$(PHP) -l "$(f)" || status=1; ) \
	exit $$status

test:
	@command -v $(PHP) >/dev/null 2>&1 || { echo "BLOCKED: php is not available"; exit 2; }
	$(PHP) "$(ROOT)/tests/bridge/run.php"

parity:
	@command -v $(PHP) >/dev/null 2>&1 || { echo "BLOCKED: php is not available"; exit 2; }
	$(PHP) "$(ROOT)/tests/bridge/parity.php"
