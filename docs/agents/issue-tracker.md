# Issue Tracker: GitHub

Issues and PRDs live in GitHub Issues for `giacomoguidotto/guidotto-dev`. Use `gh` from this clone.

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --comments`
- List: `gh issue list --state open --json number,title,labels`
- Comment: `gh issue comment <number> --body "..."`
- Label: `gh issue edit <number> --add-label "..."`
- Close: `gh issue close <number> --comment "..."`
