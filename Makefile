# This Makefile follows the advice in: https://tech.davis-hansson.com/p/make/

SHELL := bash
.ONESHELL:
.SHELLFLAGS := -eu -o pipefail -O inherit_errexit -c
.DELETE_ON_ERROR:
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules

ifeq ($(origin .RECIPEPREFIX), undefined)
> $(error This Make does not support .RECIPEPREFIX. Please use GNU Make 4.0 or later)
endif
.RECIPEPREFIX = >

help:
> echo "Available targets:"
> printf '  %s\n' $$(grep -P --only-matching '^[\w-]+(?=:)' Makefile)
.PHONY: help
.SILENT: help

.out:
> mkdir -p .out

clean:
> rm -rf .out
.PHONY: clean

lint: ensure-licensed
> deno lint
.PHONY: lint

check-format:
> deno fmt --check
.PHONY: check-format

apply-format:
> deno fmt
.PHONY: auto-format-files

test:
> deno test
.PHONY: test

test-leaks:
# We have tests that intentionally trigger resource leaks. We need to run these
# one-by-one, otherwise it's not possible to know if any individual leaking test
# is/isn't leaking.
# We do this by running the test suite filtering on only leaking tests to
# discover their names (leaking tests are skipped run unless an envar is set).
# Then run each one individually by name.
> run_leaking_test () {
>   TEST_NAME="$${1:?}"
>   export ENABLE_LEAKING_TESTS=1
>   status=0
>   echo -e "\n- test $$TEST_NAME"
>   output="$$(deno test --allow-env=ENABLE_LEAKING_TESTS --filter "$$TEST_NAME" 2>&1)" || status=$$?
>   echo "  |" 1>&2
>   <<<"$$output" grep -v '^running 0 tests from file://' | sed 's/^/  |  /' 1>&2
>   echo "  +-----------------------------------------------------------------------------" 1>&2
>   if [[ $$status -eq 0 ]]; then
>     echo "  | FAIL: the leaking test unexpectedly passed" 1>&2
>     result_status=1
>   else
>     echo "  | MAYBE PASS: the leaking test failed as expected, but output requires manual verification..." 1>&2
>   fi
>   echo "  +-----------------------------------------------------------------------------" 1>&2
>   exit $${result_status:0}
> }
> export -f run_leaking_test
> deno test --filter '[💦 LEAKING TEST 💦]' \
  | grep --only-matching -P '(?<=^test )(.*\[💦 LEAKING TEST 💦\].*)(?= ... .*$$)' \
  | tr '\n' '\000' \
  | xargs -0 -I '{}' bash -c 'run_leaking_test "$${1:?}"' -- '{}'
.PHONY: test-leaks
.SILENT: test-leaks

ensure-licensed:
> UNLICENSED="$$(\
  find . -name '*.ts' -not -path './examples/*' -exec \
    grep -FL '// Copyright 2021 Hal Blackburn. All rights reserved. MIT license.' {} + \
    || test $$? -eq 1 \
  )"
> if [[ $$UNLICENSED != "" ]]; then
>   echo -e "Error: Not all modules contain the copyright header:\n$$UNLICENSED" 2>&1
>   exit 1
> fi
.PHONY: ensure-licensed
.SILENT: ensure-licensed

bump-version:
> npx standard-version@^9.3.2
.PHONY: bump-version
