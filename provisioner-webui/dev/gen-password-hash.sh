#!/bin/bash

#
# Copyright © 2025. Cloud Software Group, Inc.
# This file is subject to the license terms contained
# in the license file that is distributed with this file.
#

# This script uses a random salt and generates a sha512 hash of the salt and password supplied.
# Passwords are not stored on the Platform Provisioner UI server, only the hash of the password and the salt used to generate the hash.
# The hash and salt are stored as base46 encoded values in the following format:
# <username>:<sha512 password+salt hash>:<salt used to generate hash>

# Make sure the username is supplied
[[ -z "$1" ]] && { echo "Usage: `basename $0` <username> <password>"; exit 1; }
username=$1

# Make sure the password is supplied
[[ -z "$2" ]] && { echo "Usage: `basename $0` <username> <password>"; exit 1; }
password=$2

# Generate a random salt
salt=$(openssl rand -base64 21)

# Generate a sha512 has using the salt and password
pw_hash=$(echo -En ${password}${salt} | openssl sha512 | sed 's/.* //')

# Base64 encode the output to be stored on the server
encoded_auth=$(echo -En "${username}:${pw_hash}:${salt}" | base64)
echo ${encoded_auth}
