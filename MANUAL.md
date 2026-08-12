# Docs
Go language specification
[https://go.dev/ref/spec]

About packages API
[https://pkg.go.dev/]

Go by example
[https://gobyexample.com/]

Or instead of websites:
go doc ${pkg_to_check}

## Example

go doc log

# Shell

# Check if docker sql is running
`docker exec ${postgres-docker-container-name} pg_isready -U ${postgres-username}`

## Example

`docker exec unghosted-electric-postgres-1 pg_isready -U fa1t`

## Output

`/var/run/postgresql:5432 - accepting connections`

# Run interactive psql shell
Don't forget to put semicolon (;) when you finished typing whole command.

# With docker

## Example
`sudo docker exec -ti unghosted-electric-postgres-1 psql -U fa1t -d unghosted`

## Output
Interactive sql shell to access the database

# With local install of Postgres

## Example 

Launch psql shell with postgres user

`sudo -u postgres psql`

## Output
Interactive sql shell to access the database

`\c unghosted`

## Output
Interactive sql shell to access the database
