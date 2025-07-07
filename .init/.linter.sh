#!/bin/bash
cd /home/kavia/workspace/code-generation/fruitslice-challenge-120976-561c1e71/fruit_ninja_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

