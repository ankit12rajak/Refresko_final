import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { gsap } from 'gsap'
import './Hero.css'

const Hero = () => {
  const titleRef = useRef(null)
  const targetText = 'REFRESKO 2026'
  const [displayText] = useState(targetText)

  // Magnetic button effect
  useEffect(() => {
    const buttons = document.querySelectorAll('.magnetic-btn')
    
    buttons.forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect()
        const x = e.clientX - rect.left - rect.width / 2
        const y = e.clientY - rect.top - rect.height / 2
        
        gsap.to(btn, {
          x: x * 0.3,
          y: y * 0.3,
          duration: 0.3,
          ease: 'power2.out'
        })
      })
      
      btn.addEventListener('mouseleave', () => {
        gsap.to(btn, {
          x: 0,
          y: 0,
          duration: 0.5,
          ease: 'elastic.out(1, 0.3)'
        })
      })
    })
  }, [])

  return (
    <section id="home" className="hero" data-particle-shape="0">
      <div className="hero-content">
        <motion.p
          className="hero-pretitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          SKF presents...<span className="cursor">|</span>
        </motion.p>

        <motion.h2
          className="hero-date stroke-text"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          MARCH 27 - 28, 2026
        </motion.h2>

        <motion.h1
          ref={titleRef}
          className="hero-title chromatic-text"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 1 }}
        >
          {displayText}
        </motion.h1>

        <motion.p
          className="hero-subtitle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.5 }}
        >
          A celebration of technology, culture, and pure adrenaline brought to you by 
          Supreme Knowledge Foundation. Join the revolution.
        </motion.p>

        <motion.div
          className="hero-cta"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 2 }}
        >
          <div className="cta-group">
            <Link to="/events" className="btn-primary magnetic-btn skewed-btn interactive">
              <span>REGISTER FOR EVENTS</span>
            </Link>
            <p className="cta-description">
              Participate for the Events
            </p>
          </div>
          
          <div className="cta-group">
            <Link to="/login" className="btn-secondary magnetic-btn glass interactive">
              <span>SKF STUDENT LOGIN</span>
            </Link>
            <p className="cta-description">
              Already an SKF student? Login here
            </p>
          </div>
        </motion.div>
      </div>

      <div className="hero-scroll-indicator">
        <motion.div
          className="scroll-line"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 1, delay: 2.5 }}
        />
      </div>
    </section>
  )
}

export default Hero
