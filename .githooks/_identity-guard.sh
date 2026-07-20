#!/bin/sh

set -eu

PROOFLINE_EXPECTED_GIT_NAME='mattin89'
PROOFLINE_EXPECTED_GIT_EMAIL='11786939+mattin89@users.noreply.github.com'

proofline_trim() {
  trimmed=$1
  tab=$(printf '\t')

  while :; do
    case "$trimmed" in
      ' '*|"$tab"*) trimmed=${trimmed#?} ;;
      *) break ;;
    esac
  done

  while :; do
    case "$trimmed" in
      *' '|*"$tab") trimmed=${trimmed%?} ;;
      *) break ;;
    esac
  done

  printf '%s\n' "$trimmed"
}

proofline_email_from_ident() {
  ident_value=$1
  case "$ident_value" in
    *'<'*'>'*)
      email=${ident_value#*<}
      email=${email%%>*}
      printf '%s\n' "$email"
      ;;
    *)
      printf '\n'
      ;;
  esac
}

proofline_reject_identity() {
  role=$1
  actual_name=$2
  actual_email=$3

  printf '%s\n' \
    "Proofline blocked this Git operation: $role is '$actual_name <$actual_email>'." \
    "Expected '$PROOFLINE_EXPECTED_GIT_NAME <$PROOFLINE_EXPECTED_GIT_EMAIL>'." \
    "Repair it with:" \
    "  git config --global user.name $PROOFLINE_EXPECTED_GIT_NAME" \
    "  git config --global user.email $PROOFLINE_EXPECTED_GIT_EMAIL" >&2
  return 1
}

proofline_check_pair() {
  role=$1
  actual_name=$2
  actual_email=$3

  if [ "$actual_name" != "$PROOFLINE_EXPECTED_GIT_NAME" ] || \
     [ "$actual_email" != "$PROOFLINE_EXPECTED_GIT_EMAIL" ]; then
    proofline_reject_identity "$role" "$actual_name" "$actual_email"
  fi
}

proofline_check_ident() {
  role=$1
  ident=$2
  actual_name=${ident%% <*}
  actual_email=$(proofline_email_from_ident "$ident")
  proofline_check_pair "$role" "$actual_name" "$actual_email"
}

proofline_check_current_identity() {
  proofline_check_ident 'author identity' "$(git var GIT_AUTHOR_IDENT)"
  proofline_check_ident 'committer identity' "$(git var GIT_COMMITTER_IDENT)"
}

proofline_check_coauthor_line() {
  line=$(proofline_trim "$1")

  case "$line" in
    [Cc][Oo]-[Aa][Uu][Tt][Hh][Oo][Rr][Ee][Dd]-[Bb][Yy]:*)
      value=${line#*:}
      value=$(proofline_trim "$value")
      actual_name=${value%% <*}
      actual_name=$(proofline_trim "$actual_name")
      actual_email=$(proofline_email_from_ident "$value")
      proofline_check_pair 'co-author trailer' "$actual_name" "$actual_email"
      ;;
  esac
}

proofline_check_message_stream() {
  while IFS= read -r line || [ -n "$line" ]; do
    proofline_check_coauthor_line "$line"
  done
}

proofline_check_commit() {
  commit=$1
  short_commit=$(git rev-parse --short "$commit")
  author_name=$(git show -s --format=%an "$commit")
  author_email=$(git show -s --format=%ae "$commit")
  committer_name=$(git show -s --format=%cn "$commit")
  committer_email=$(git show -s --format=%ce "$commit")

  proofline_check_pair "commit $short_commit author" "$author_name" "$author_email"
  proofline_check_pair "commit $short_commit committer" "$committer_name" "$committer_email"
  git show -s --format=%B "$commit" | proofline_check_message_stream
}
