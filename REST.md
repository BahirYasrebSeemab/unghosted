# NO REST FOR THE WICKED, I GUESS

# Request -- Response

# Healthz
Route: `localhost:3000/healtz/` - for pinging
Request: GET `{}`
Response: "ok" 

All the requests before should be performed having refresh_token in Cookies header

# Room

All the request in this section should have following header:
`Authorization: "Bearer <access_token>"`

## Create

Route: `localhost:3000/v1/create` - create room with ID in db
Request: POST `{ candidateName: string, role: string, createdBy: string}`
Response: http.StatusCreated (201 I guess)

## List

Route: `localhost:3000/v1/list` - list all rooms, kinda useless
Request: GET `{}`
Response: JSON with all the rooms `{ []Room }`

## {roomID}

Route: `localhost:3000/v1/{roomId}` - get info about the room
Request: GET `{}`
Response: JSON with data about the room `{ Room }`

## Websocket

Prefix is very imporant for connection to establish

Route: `ws://localhost:3000/v1/{roomId}/ws` - connect to rooms websocket
Request: GET `{}`
Response: Established connection (http code: 000)

# Auth

## Send Code

Route: `localhost:3000/v1/users/sendCode` - send verification code to email and create user
Request: Post `{name: string, email: string, password: string}`
Response: http.StatusCreated (201 guess)

## Register

Route: `localhost:3000/v1/users/register` - verify account and register new user for real.
Request: Post `{email: string, code: string}`
Response: http.StatusCreated (201 guess)

## Login

Route: `localhost:3000/v1/register/login`  - login user
Request: Post `{ email: string, password: string }`
Response: `{ acces_token }`

## Refresh

Route: `localhost:3000/v1/auth/refresh` - get new refres token
Request: Post `{email: string, code: string}`
Response: http.StatusCreated (201 guess)

# Companies

## Create

Route: `localhost:3000/v1/companies/create` - crete company
Request: Post `{ name: string }`
Response: http.StatusCreated (201 guess)

## Delete

Route: `localhost:3000/v1/companies/delete` - delete company
Request: Post `{ id: string }`
Response: http.StatusOK (200)

## reduceBalance

Route: `localhost:3000/v1/companies/reducebalance` - take away some tokens from company balance
Request: Post `{ id: string(???), value: int}`
Response: http.StatusOK (200)

## increaseBalance

Route: `localhost:3000/v1/companies/increasebalance` -add some tokens to company balance
Request: Post `{ id: string(???), value: int}`
Response: http.StatusOK (200)

## updateName

Route: `localhost:3000/v1/companies/updateName` - change company's name
Request: Post `{ id: string(???), name: string }`
Response: http.StatusOK (200)

## addAdmin

Route: `localhost:3000/v1/companies/addAdmin` - add admin (moderator) to company
Request: Post `{ id: string(???), name: string }`
Response: http.StatusOK (200)

## addAdmin

Route: `localhost:3000/v1/companies/addHr` - add hiring manager (interviewer)
Request: Post `{ id: string(???), name: string }`
Response: http.StatusOK (200)
