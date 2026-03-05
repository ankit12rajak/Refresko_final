import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import CustomCursor from '../components/CustomCursor/CustomCursor'
import './ComingSoonPage.css'

const ComingSoonPage = ({ title, subtitle, launchLine }) => {
	const isEventsPage = title?.toLowerCase() === 'events'

	return (
		<div className="coming-soon">
			<CustomCursor />
			<div className="hex-grid-overlay" />

			<header className="coming-soon-header">
				<div className="coming-soon-logo">
					<span className="logo-main">REFRESKO</span>
					<span className="logo-year">2026</span>
				</div>
				<Link className="coming-soon-link interactive" to="/">
					BACK TO HOME
				</Link>
			</header>

			<main className={`coming-soon-main ${isEventsPage ? 'events-only-main' : ''}`}>
				{isEventsPage && (
					<motion.h1
						className="events-page-heading"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: 0.15 }}
					>
						EVENTS
					</motion.h1>
				)}
				{!isEventsPage && (
					<>
						<motion.div
							className="coming-soon-badge"
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.6 }}
						>
							SUPREME KNOWLEDGE FOUNDATION
						</motion.div>

						<motion.h1
							className="coming-soon-title"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.8, delay: 0.1 }}
						>
							{title}
							<span className="title-accent">COMING SOON</span>
						</motion.h1>

						<motion.p
							className="coming-soon-subtitle"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.8, delay: 0.2 }}
						>
							{subtitle}
						</motion.p>
					</>
				)}

				{isEventsPage && (
					<motion.div
						className="coming-soon-banner"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.8, delay: 0.25 }}
					>
						<img
							className="coming-soon-banner-image"
							src="/event%20banner.png"
							alt="Events banner"
							loading="lazy"
							decoding="async"
						/>
					</motion.div>
				)}

				{!isEventsPage && (
					<>
						<motion.div
							className="coming-soon-launch"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.8, delay: 0.3 }}
						>
							<span className="launch-label">LAUNCH WINDOW</span>
							<span className="launch-value neon-text">{launchLine}</span>
						</motion.div>

						<motion.form
							className="coming-soon-form"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.8, delay: 0.4 }}
							onSubmit={(event) => event.preventDefault()}
						>
							<input
								className="coming-soon-input"
								type="email"
								name="email"
								placeholder="Enter your email for early access"
								autoComplete="email"
							/>
							<button className="coming-soon-button interactive" type="submit">
								JOIN WAITLIST
							</button>
						</motion.form>
					</>
				)}

				<motion.div
					className="coming-soon-actions"
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.8, delay: 0.5 }}
				>
					{isEventsPage && (
						<a
							className="btn-outline interactive"
							href="https://forms.gle/R9icZUxEevYpWe6L8"
							target="_blank"
							rel="noopener noreferrer"
						>
							REGISTER NOW
							<span className="btn-arrow">→</span>
						</a>
					)}
					{!isEventsPage && (
						<Link className="btn-outline interactive" to="/">
							RETURN TO REFRESKO
							<span className="btn-arrow">→</span>
						</Link>
					)}
				</motion.div>
			</main>

			<div className="coming-soon-atmosphere">
				<span className="glow-orb orb-one" />
				<span className="glow-orb orb-two" />
				<span className="signal-line" />
				<span className="signal-line" />
				<span className="signal-line" />
			</div>
		</div>
	)
}

export default ComingSoonPage
