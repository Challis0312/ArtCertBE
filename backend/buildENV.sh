#!/bin/bash

# usage is buildENV.sh [TEST|PROD] this will generate a .ENV
# this is for use in an AWS amplify script

# Exit immediately if a command exits with a non-zero status.
set -e

# Check if the target environment is provided.
if [ -z "$1" ]; then
    echo "Error: No target environment specified. Usage: buildENV.sh [LOCAL|DEV|TEST|PROD]"
    exit 1
fi


# output to another file
if [ -z "$2" ]; then
    OUTPUT=".env" 
else
  OUTPUT="$2.env" 
fi

TARGET=$1
ERROR_FLAG=0

varsArray=( 'LISTEN_PORT'\
            'AWS_REGION'\
            'POSTGRES_HOST'\
            'POSTGRES_USER'\
            'POSTGRES_PASSWORD'\
            'POSTGRES_DB'\
            'POSTGRES_WAIT_FOR_CONNECT'\
            'POSTGRES_CONNECT_LIMIT'\
            'POSTGRES_MAX_IDLE'\
            'POSTGRES_IDLE_TIMEOUT'\
            'POSTGRES_QUEUE_LIMIT' )

echo 'NODE_ENV='$TARGET > "$OUTPUT"

for str in ${varsArray[@]}; do 
    varname=${TARGET}_$str
    if [ -z ${!varname} ];then
        echo $str="Error: $varname is not set" >> "$OUTPUT"
        ERROR_FLAG=1
    else
        echo $str=${!varname} >> "$OUTPUT"
    fi
done

if [ $ERROR_FLAG -eq 1 ]; then
    echo "Error: Some variables were not set. see $OUTPUT file for details."
    cat "$OUTPUT"
    exit -1
else
    echo "Environment file created successfully."
    exit 0
fi



