'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/auth-client'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const isSignUp = mode === 'sign-up'

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError('')
    setPending(true)
    try {
      const result = isSignUp
        ? await authClient.signUp.email({ name: String(form.get('name')), email: String(form.get('email')), password: String(form.get('password')) })
        : await authClient.signIn.email({ email: String(form.get('email')), password: String(form.get('password')) })
      if (result.error) throw new Error('We could not sign you in with those details. Check them and try again.')
      router.replace('/')
      router.refresh()
    } catch {
      setError(isSignUp ? 'We could not create your account. Check your details and try again.' : 'We could not sign you in with those details. Check them and try again.')
    } finally {
      setPending(false)
    }
  }

  return <main className="auth-screen">
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="brand-mark" aria-hidden="true">L</div>
      <p className="eyebrow">YOUR MONEY, CLEARLY</p>
      <h1 id="auth-title">{isSignUp ? 'Start your Ledger' : 'Welcome back'}</h1>
      <p className="auth-copy">{isSignUp ? 'A calmer way to see where your money goes.' : 'Sign in to pick up where you left off.'}</p>
      <form onSubmit={submit} className="auth-form">
        {isSignUp && <label>Name<input name="name" required autoComplete="name" maxLength={80} /></label>}
        <label>Email<input name="email" type="email" required autoComplete="email" /></label>
        <label>Password<input name="password" type="password" required minLength={8} autoComplete={isSignUp ? 'new-password' : 'current-password'} /></label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="primary-button full-button" type="submit" disabled={pending}>{pending ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}</button>
      </form>
      <p className="auth-switch">{isSignUp ? 'Already have an account?' : 'New to Ledger?'} <Link href={isSignUp ? '/sign-in' : '/sign-up'}>{isSignUp ? 'Sign in' : 'Create an account'}</Link></p>
      <p className="privacy-note">Your financial data is private to your account and syncs securely across devices.</p>
    </section>
  </main>
}
