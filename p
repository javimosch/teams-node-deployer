filter.lfs.process=git-lfs filter-process
filter.lfs.required=true
filter.lfs.clean=git-lfs clean -- %f
filter.lfs.smudge=git-lfs smudge -- %f
alias.st=status
alias.co=checkout
alias.ba=branch -v -a
alias.nlog=log --name-status
alias.glog=log --graph --abbrev-commit
alias.sglog=log --graph --abbrev-commit --pretty=oneline
alias.slog=log --pretty=oneline --abbrev-commit
alias.dlog=log -p
alias.relog=log --graph --abbrev-commit --pretty=oneline --no-merges
alias.ci=commit -v
alias.br=branch -v
alias.ru=remote update
alias.su=submodule update --recursive
alias.si=submodule init
alias.changelog=log --graph --abbrev-commit --pretty=oneline --no-merges origin/prod..
alias.changelog2=log --graph --abbrev-commit --pretty=oneline --no-merges origin/master..
alias.changelog-preprod=log --graph --abbrev-commit --pretty=oneline --no-merges origin/preprod..
alias.nchangelog=log --name-status --abbrev-commit --pretty=oneline --no-merges origin/prod..
alias.flog=log --decorate=short
alias.filediff=log --pretty= --no-merges origin/master.. --name-only
alias.ware=branch -a --contains
core.editor=/usr/bin/vim
core.autocrlf=false
core.eol=lf
color.ui=true
user.email=arancibiajav@gmail.com
user.name=Jarancibia
filter.lfs.clean=git-lfs clean -- %f
filter.lfs.smudge=git-lfs smudge -- %f
filter.lfs.process=git-lfs filter-process
filter.lfs.required=true
pull.twohead=ort
pull.rebase=false
init.defaultbranch=master
core.repositoryformatversion=0
core.filemode=true
core.bare=false
core.logallrefupdates=true
remote.gh.url=git@github.com:javimosch/teams-node-deployer.git
remote.gh.fetch=+refs/heads/*:refs/remotes/gh/*
remote.origin.url=ssh://git@git.geored.fr:220/RD_soft/pocs/teams-node-deployer.git
remote.origin.fetch=+refs/heads/*:refs/remotes/origin/*
