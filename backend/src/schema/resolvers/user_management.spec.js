import gql from 'graphql-tag'
import { GraphQLClient, request } from 'graphql-request'
import jwt from 'jsonwebtoken'
import CONFIG from './../../config'
import Factory from '../../seed/factories'
import { host, login } from '../../jest/helpers'

const factory = Factory()

// here is the decoded JWT token:
// {
//   role: 'user',
//   locationName: null,
//   name: 'Jenny Rostock',
//   about: null,
//   avatar: 'https://s3.amazonaws.com/uifaces/faces/twitter/sasha_shestakov/128.jpg',
//   id: 'u3',
//   email: 'user@example.org',
//   slug: 'jenny-rostock',
//   iat: 1550846680,
//   exp: 1637246680,
//   aud: 'http://localhost:3000',
//   iss: 'http://localhost:4000',
//   sub: 'u3'
// }
const jennyRostocksHeaders = {
  authorization:
    'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoidXNlciIsImxvY2F0aW9uTmFtZSI6bnVsbCwibmFtZSI6Ikplbm55IFJvc3RvY2siLCJhYm91dCI6bnVsbCwiYXZhdGFyIjoiaHR0cHM6Ly9zMy5hbWF6b25hd3MuY29tL3VpZmFjZXMvZmFjZXMvdHdpdHRlci9zYXNoYV9zaGVzdGFrb3YvMTI4LmpwZyIsImlkIjoidTMiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5vcmciLCJzbHVnIjoiamVubnktcm9zdG9jayIsImlhdCI6MTU1MDg0NjY4MCwiZXhwIjoxNjM3MjQ2NjgwLCJhdWQiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJpc3MiOiJodHRwOi8vbG9jYWxob3N0OjQwMDAiLCJzdWIiOiJ1MyJ9.eZ_mVKas4Wzoc_JrQTEWXyRn7eY64cdIg4vqQ-F_7Jc',
}

const disable = async id => {
  const moderatorParams = { email: 'moderator@example.org', role: 'moderator', password: '1234' }
  const asModerator = Factory()
  await asModerator.create('User', moderatorParams)
  await asModerator.authenticateAs(moderatorParams)
  await asModerator.mutate('mutation($id: ID!) { disable(id: $id) }', { id })
}

beforeEach(async () => {
  await factory.create('User', {
    avatar: 'https://s3.amazonaws.com/uifaces/faces/twitter/jimmuirhead/128.jpg',
    id: 'acb2d923-f3af-479e-9f00-61b12e864666',
    name: 'Matilde Hermiston',
    slug: 'matilde-hermiston',
    role: 'user',
    email: 'test@example.org',
    password: '1234',
  })
})

afterEach(async () => {
  await factory.cleanDatabase()
})

describe('isLoggedIn', () => {
  const query = '{ isLoggedIn }'
  describe('unauthenticated', () => {
    it('returns false', async () => {
      await expect(request(host, query)).resolves.toEqual({
        isLoggedIn: false,
      })
    })
  })

  describe('with malformed JWT Bearer token', () => {
    const headers = { authorization: 'blah' }
    const client = new GraphQLClient(host, { headers })

    it('returns false', async () => {
      await expect(client.request(query)).resolves.toEqual({
        isLoggedIn: false,
      })
    })
  })

  describe('with valid JWT Bearer token', () => {
    const client = new GraphQLClient(host, { headers: jennyRostocksHeaders })

    it('returns false', async () => {
      await expect(client.request(query)).resolves.toEqual({
        isLoggedIn: false,
      })
    })

    describe('and a corresponding user in the database', () => {
      describe('user is enabled', () => {
        it('returns true', async () => {
          // see the decoded token above
          await factory.create('User', { id: 'u3' })
          await expect(client.request(query)).resolves.toEqual({
            isLoggedIn: true,
          })
        })
      })

      describe('user is disabled', () => {
        beforeEach(async () => {
          await factory.create('User', { id: 'u3' })
          await disable('u3')
        })

        it('returns false', async () => {
          await expect(client.request(query)).resolves.toEqual({
            isLoggedIn: false,
          })
        })
      })
    })
  })
})

describe('currentUser', () => {
  const query = `{
    currentUser {
      id
      slug
      name
      avatar
      email
      role
    }
  }`

  describe('unauthenticated', () => {
    it('returns null', async () => {
      const expected = { currentUser: null }
      await expect(request(host, query)).resolves.toEqual(expected)
    })
  })

  describe('with valid JWT Bearer Token', () => {
    let client
    let headers

    describe('but no corresponding user in the database', () => {
      beforeEach(async () => {
        client = new GraphQLClient(host, { headers: jennyRostocksHeaders })
      })

      it('returns null', async () => {
        const expected = { currentUser: null }
        await expect(client.request(query)).resolves.toEqual(expected)
      })
    })

    describe('and corresponding user in the database', () => {
      beforeEach(async () => {
        headers = await login({ email: 'test@example.org', password: '1234' })
        client = new GraphQLClient(host, { headers })
      })

      it('returns the whole user object', async () => {
        const expected = {
          currentUser: {
            avatar: 'https://s3.amazonaws.com/uifaces/faces/twitter/jimmuirhead/128.jpg',
            email: 'test@example.org',
            id: 'acb2d923-f3af-479e-9f00-61b12e864666',
            name: 'Matilde Hermiston',
            slug: 'matilde-hermiston',
            role: 'user',
          },
        }
        await expect(client.request(query)).resolves.toEqual(expected)
      })
    })
  })
})

describe('login', () => {
  const mutation = params => {
    const { email, password } = params
    return `
      mutation {
        login(email:"${email}", password:"${password}")
      }`
  }

  describe('ask for a `token`', () => {
    describe('with valid email/password combination', () => {
      it('responds with a JWT token', async () => {
        const data = await request(
          host,
          mutation({
            email: 'test@example.org',
            password: '1234',
          }),
        )
        const token = data.login
        jwt.verify(token, CONFIG.JWT_SECRET, (err, data) => {
          expect(data.email).toEqual('test@example.org')
          expect(err).toBeNull()
        })
      })
    })

    describe('valid email/password but user is disabled', () => {
      it('responds with "Your account has been disabled."', async () => {
        await disable('acb2d923-f3af-479e-9f00-61b12e864666')
        await expect(
          request(
            host,
            mutation({
              email: 'test@example.org',
              password: '1234',
            }),
          ),
        ).rejects.toThrow('Your account has been disabled.')
      })
    })

    describe('with a valid email but incorrect password', () => {
      it('responds with "Incorrect email address or password."', async () => {
        await expect(
          request(
            host,
            mutation({
              email: 'test@example.org',
              password: 'wrong',
            }),
          ),
        ).rejects.toThrow('Incorrect email address or password.')
      })
    })

    describe('with a non-existing email', () => {
      it('responds with "Incorrect email address or password."', async () => {
        await expect(
          request(
            host,
            mutation({
              email: 'non-existent@example.org',
              password: 'wrong',
            }),
          ),
        ).rejects.toThrow('Incorrect email address or password.')
      })
    })
  })
})

describe('change password', () => {
  let headers
  let client

  beforeEach(async () => {
    headers = await login({ email: 'test@example.org', password: '1234' })
    client = new GraphQLClient(host, { headers })
  })

  const mutation = params => {
    const { oldPassword, newPassword } = params
    return `
      mutation {
        changePassword(oldPassword:"${oldPassword}", newPassword:"${newPassword}")
      }`
  }

  describe('should be authenticated before changing password', () => {
    it('throws "Not Authorised!"', async () => {
      await expect(
        request(
          host,
          mutation({
            oldPassword: '1234',
            newPassword: '1234',
          }),
        ),
      ).rejects.toThrow('Not Authorised!')
    })
  })

  describe('old and new password should not match', () => {
    it('responds with "Old password and new password should be different"', async () => {
      await expect(
        client.request(
          mutation({
            oldPassword: '1234',
            newPassword: '1234',
          }),
        ),
      ).rejects.toThrow('Old password and new password should be different')
    })
  })

  describe('incorrect old password', () => {
    it('responds with "Old password isn\'t valid"', async () => {
      await expect(
        client.request(
          mutation({
            oldPassword: 'notOldPassword',
            newPassword: '12345',
          }),
        ),
      ).rejects.toThrow('Old password is not correct')
    })
  })

  describe('correct password', () => {
    it('changes the password if given correct credentials "', async () => {
      let response = await client.request(
        mutation({
          oldPassword: '1234',
          newPassword: '12345',
        }),
      )
      await expect(response).toEqual(
        expect.objectContaining({
          changePassword: expect.any(String),
        }),
      )
    })
  })
})

describe('do not expose private RSA key', () => {
  let headers
  let client
  let authenticatedClient

  const queryUserPuplicKey = gql`
    query($queriedUserSlug: String) {
      User(slug: $queriedUserSlug) {
        id
        publicKey
      }
    }
  `
  const queryUserPrivateKey = gql`
    query($queriedUserSlug: String) {
      User(slug: $queriedUserSlug) {
        id
        privateKey
      }
    }
  `

  const generateUserWithKeys = async authenticatedClient => {
    // Generate user with "privateKey" via 'CreateUser' mutation instead of using the factories "factory.create('User', {...})", see above.
    const variables = {
      id: 'bcb2d923-f3af-479e-9f00-61b12e864667',
      password: 'xYz',
      slug: 'apfel-strudel',
      name: 'Apfel Strudel',
      email: 'apfel-strudel@test.org',
    }
    await authenticatedClient.request(
      gql`
        mutation($id: ID, $password: String!, $slug: String, $name: String, $email: String!) {
          CreateUser(id: $id, password: $password, slug: $slug, name: $name, email: $email) {
            id
          }
        }
      `,
      variables,
    )
  }

  beforeEach(async () => {
    const adminParams = {
      role: 'admin',
      email: 'admin@example.org',
      password: '1234',
    }
    // create an admin user who has enough permissions to create other users
    await factory.create('User', adminParams)
    const headers = await login(adminParams)
    authenticatedClient = new GraphQLClient(host, { headers })
    // but also create an unauthenticated client to issue the `User` query
    client = new GraphQLClient(host)
  })

  describe('unauthenticated query of "publicKey" (does the RSA key pair get generated at all?)', () => {
    it('returns publicKey', async () => {
      await generateUserWithKeys(authenticatedClient)
      await expect(
        await client.request(queryUserPuplicKey, { queriedUserSlug: 'apfel-strudel' }),
      ).toEqual(
        expect.objectContaining({
          User: [
            {
              id: 'bcb2d923-f3af-479e-9f00-61b12e864667',
              publicKey: expect.any(String),
            },
          ],
        }),
      )
    })
  })

  describe('unauthenticated query of "privateKey"', () => {
    it('throws "Not Authorised!"', async () => {
      await generateUserWithKeys(authenticatedClient)
      await expect(
        client.request(queryUserPrivateKey, { queriedUserSlug: 'apfel-strudel' }),
      ).rejects.toThrow('Not Authorised')
    })
  })

  // authenticate
  beforeEach(async () => {
    headers = await login({ email: 'test@example.org', password: '1234' })
    client = new GraphQLClient(host, { headers })
  })

  describe('authenticated query of "publicKey"', () => {
    it('returns publicKey', async () => {
      await generateUserWithKeys(authenticatedClient)
      await expect(
        await client.request(queryUserPuplicKey, { queriedUserSlug: 'apfel-strudel' }),
      ).toEqual(
        expect.objectContaining({
          User: [
            {
              id: 'bcb2d923-f3af-479e-9f00-61b12e864667',
              publicKey: expect.any(String),
            },
          ],
        }),
      )
    })
  })

  describe('authenticated query of "privateKey"', () => {
    it('throws "Not Authorised!"', async () => {
      await generateUserWithKeys(authenticatedClient)
      await expect(
        client.request(queryUserPrivateKey, { queriedUserSlug: 'apfel-strudel' }),
      ).rejects.toThrow('Not Authorised')
    })
  })
})
