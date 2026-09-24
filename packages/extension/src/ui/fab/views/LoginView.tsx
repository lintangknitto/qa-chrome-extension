import React, { useState } from 'react';
import { User, Lock, LogIn } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

interface LoginViewProps {
	busy: boolean;
	error: string | null;
	onSubmit: (credentials: { username: string; password: string }) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ busy, error, onSubmit }) => {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');

	return (
		<Card>
			<CardHeader>
				<div>
					<CardTitle>Login ke QA Server</CardTitle>
					<CardDescription>Masuk untuk merekam skenario dan mengelola sesi pengujian</CardDescription>
				</div>
			</CardHeader>
			<CardContent>
				{error && <div className="sp-error">{error}</div>}

				<Input
					label="Username"
					icon={<User size={15} />}
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					placeholder="Masukkan username"
					autoFocus
					required
				/>

				<Input
					label="Password"
					type="password"
					icon={<Lock size={15} />}
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					placeholder="Masukkan password"
					required
					onKeyDown={(e) => {
						if (e.key === 'Enter' && !busy && username && password) {
							onSubmit({ username, password });
						}
					}}
				/>

				<div style={{ marginTop: '16px' }}>
					<Button
						style={{ width: '100%' }}
						loading={busy}
						disabled={busy || !username || !password}
						onClick={() => onSubmit({ username, password })}
						icon={<LogIn size={15} />}
					>
						{busy ? 'Memproses...' : 'Login'}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
};
