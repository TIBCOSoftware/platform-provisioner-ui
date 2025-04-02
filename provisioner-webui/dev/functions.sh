#!/bin/bash

#
# Copyright © 2025. Cloud Software Group, Inc.
# This file is subject to the license terms contained
# in the license file that is distributed with this file.
#

# Define the colors that will be used in other shell scripts
CROSS="\u274c"
TICK="\u2714"
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BLACK='\033[0;30m'
BROWN='\033[0;33m'
CYAN='\033[0;36m'
DARK_GRAY='\033[1;30m'
DEFAULT='\033[0m'
LIGHT_BLUE='\033[1;34m'
LIGHT_CYAN='\033[1;36m'
LIGHT_GRAY='\033[0;37m'
LIGHT_GREEN='\033[1;32m'
LIGHT_PURPLE='\033[1;35m'
LIGHT_RED='\033[1;31m'
PURPLE='\033[0;35m'
WHITE='\033[1;37m'

fct_print_msg() {
  # shellcheck disable=SC2059
  printf "${DEFAULT}[$(date +'%T')] $1"
}

fct_print_info_msg() {
  fct_print_msg "${BLUE}[INFO] $1${DEFAULT}\n"
}

fct_print_warn_msg() {
  fct_print_msg "${YELLOW}[WARN] $1${DEFAULT}\n"
}

fct_print_error_msg() {
  fct_print_msg "${RED}[ERROR] $1${DEFAULT}\n"
}

fct_print_success_msg() {
  fct_print_msg "${LIGHT_GREEN}[SUCCESS] $1${DEFAULT}\n"
}
