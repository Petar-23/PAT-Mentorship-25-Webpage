// src/components/layout/footer.tsx
'use client'

import Link from "next/link"
import Image from "next/image"
import { Youtube, Twitter, Cookie } from "lucide-react"
import { useCookieSettings } from "@/lib/cookie-settings"

export function Footer() {
  const { openSettings } = useCookieSettings()
  
  const legalLinks = [
    {
      title: "Impressum",
      href: "/impressum",
      description: "Rechtliche Informationen über den Dienstanbieter"
    },
    {
      title: "Datenschutz",
      href: "/datenschutz",
      description: "Informationen zur Verarbeitung personenbezogener Daten"
    },
    {
      title: "AGB",
      href: "/agb",
      description: "Allgemeine Geschäftsbedingungen"
    },
    {
      title: "Widerrufsbelehrung",
      href: "/widerruf",
      description: "Informationen zum Widerrufsrecht"
    }
  ]

  const socialLinks = [
    {
      name: "YouTube",
      href: "https://youtube.com/@yourhandle",
      icon: Youtube,
      color: "text-red-500 hover:text-red-600"
    },
    {
      name: "Twitter",
      href: "https://twitter.com/yourhandle",
      icon: Twitter,
      color: "text-blue-400 hover:text-blue-500"
    }
  ]

  const contactInfo = [
    {
      label: "Email",
      value: "kontakt@example.com"
    },
    {
      label: "Telefon",
      value: "+49 123 456789"
    }
  ]

  return (
    <footer className="border-t border-slate-800 bg-slate-950">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <Link 
              href="/" 
              className="inline-flex items-center gap-4 group mb-6 hover:opacity-90 transition-opacity"
            >
              <Image
                src="/images/hero/PAT-logo.png"
                alt="PAT Mentorship Logo"
                width={40}
                height={40}
                className="rounded-lg"
              />
              <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                PAT Mentorship
              </h3>
            </Link>
            <p className="text-sm text-gray-400 mb-4">
              Professional Trading Mentorship
              <br />
              Eingetragener Kaufmann
            </p>
            {contactInfo.map((item, index) => (
              <p key={index} className="text-sm text-gray-400">
                <span className="font-medium text-gray-300">{item.label}:</span>{' '}
                <span className="hover:text-blue-400 transition-colors">
                  {item.value}
                </span>
              </p>
            ))}
          </div>

          {/* Legal Links */}
          <div className="md:col-span-2">
            <h3 className="font-semibold text-white mb-4">
              Rechtliche Informationen
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {legalLinks.map((link, index) => (
                <div key={index} className="text-sm group">
                  <Link 
                    href={link.href}
                    className="text-blue-400 hover:text-blue-300 transition-colors font-medium inline-flex items-center gap-1"
                  >
                    {link.title}
                    <svg
                      className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                  <p className="text-gray-400 mt-1">
                    {link.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Social Links and Cookie Settings */}
          <div className="space-y-8">
            {/* Social Links */}
            <div>
              <h3 className="font-semibold text-white mb-4">
                Folge uns
              </h3>
              <div className="space-y-4">
                {socialLinks.map((social) => {
                  const Icon = social.icon
                  return (
                    <a
                      key={social.name}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-3 ${social.color} transition-colors`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-gray-300 hover:text-white transition-colors">
                        {social.name}
                      </span>
                    </a>
                  )
                })}
              </div>
            </div>

            {/* Cookie Settings */}
            <div>
              <button
                onClick={openSettings}
                className="flex items-center gap-3 text-gray-400 hover:text-gray-300 transition-colors group"
              >
                <Cookie className="h-5 w-5" />
                <span className="text-sm font-medium">Cookie-Einstellungen</span>
                <svg
                  className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-slate-800/50 mt-12 pt-8">
          <p className="text-sm text-gray-400 text-center">
            © {new Date().getFullYear()} PAT Mentorship. Alle Rechte vorbehalten.
          </p>
        </div>
      </div>
    </footer>
  )
}