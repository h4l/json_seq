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

lint:
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

