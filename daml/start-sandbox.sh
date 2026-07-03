#!/bin/bash
export PATH="/home/deploy/.daml/bin:$PATH"
cd /opt/cognivern/daml
exec daml start --start-navigator=no
