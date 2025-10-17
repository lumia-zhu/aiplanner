import { redirect } from 'next/navigation'

export default function Home() {
  // 直接重定向到登录页
  redirect('/auth/login')
}
