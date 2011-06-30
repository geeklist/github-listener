#!/usr/bin/env bash
# Copyright Votizen 2011

# $0 - deploy.sh
# $1 - sha
# $2 - ref
# $3 - github owner
# $4 - github repo

TARGETS[0]="git@host.com:some/path.git"
LBRANCH[0]="deploy"
RBRANCH[0]="master"

NOW=`date +%s`
SHA=$1
SHORT_SHA=`echo "$SHA" | cut -c 1-7`
GITHUB_USER=$3
GITHUB_REPO=$4
GIT_URI="git@github.com:$GITHUB_USER/$GITHUB_REPO.git"

ID="$NOW-$SHORT_SHA"
DIR="/home/node/deploy/default/$ID"

i=0
for target in ${TARGETS[@]}; do
  if [ -d $DIR ]; then
    rm -rf "$DIR"
  fi

  git clone "$GIT_URI" "$DIR"
  cd "$DIR"

  npm test

  if [ 0 != $? ]; then 
    echo "Tests failed"
    exit 1
  fi

  git remote add deploy "$target"
  git checkout -f ${LBRANCH[$i]}

  if [ ${RBRANCH[$i]} != ${LBRANCH[$i]} ]; then
    git branch -D ${RBRANCH[$i]}
    git checkout -b ${RBRANCH[$i]}
  fi

  git push deploy ${RBRANCH[$i]}
  git remote rm deploy

  cd ..

  i=$((i + 1))
done

echo "Done."
