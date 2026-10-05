import React from 'react';
import { Link } from 'react-router-dom';

const AdminProfile = ({ loggedInUser }) => {
    if (!loggedInUser) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-[#3a0810] via-[#4a0a13] to-[#5c0a18] pt-24 px-4">
                <div className="glass-card animate-fade-in-up mx-auto max-w-2xl rounded-2xl p-8 text-center text-amber-100">
                    Please login first.
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen bg-gradient-to-b from-[#3a0810] via-[#4a0a13] to-[#5c0a18] pt-24 px-4 pb-12 overflow-hidden">
            <div className="bg-blob -top-16 -left-16 h-64 w-64 bg-amber-500/20 animate-float-slow"></div>
            <div className="bg-blob bottom-0 -right-16 h-64 w-64 bg-rose-500/15 animate-float-slower"></div>
            <div className="glass-card animate-fade-in-up relative z-10 mx-auto max-w-3xl rounded-3xl p-6 sm:p-8">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gradient-gold">Admin Profile</h1>
                <p className="mt-2 text-rose-200/90">This profile is for admin access only. Candidate registration fields are not required for super user/admin users.</p>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-black/20 border border-red-800/40 p-4">
                        <p className="text-xs text-rose-200/70">Name</p>
                        <p className="text-lg text-white font-semibold">{loggedInUser.name || 'SuperUser'}</p>
                    </div>
                    <div className="rounded-xl bg-black/20 border border-red-800/40 p-4">
                        <p className="text-xs text-rose-200/70">Email</p>
                        <p className="text-lg text-white font-semibold">{loggedInUser.email || '-'}</p>
                    </div>
                    <div className="rounded-xl bg-black/20 border border-red-800/40 p-4">
                        <p className="text-xs text-rose-200/70">Role</p>
                        <p className="text-lg text-white font-semibold">{loggedInUser.adminRole || 'admin'}</p>
                    </div>
                    <div className="rounded-xl bg-black/20 border border-red-800/40 p-4">
                        <p className="text-xs text-rose-200/70">Mobile</p>
                        <p className="text-lg text-white font-semibold">{loggedInUser.phone || '-'}</p>
                    </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                    <Link to="/admin" className="btn-3d btn-3d-gold rounded-xl px-5 py-2.5 font-bold">
                        Go To Admin Panel
                    </Link>
                    <Link to="/" className="btn-3d btn-3d-ghost rounded-xl px-5 py-2.5 font-semibold">
                        Back To Home
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AdminProfile;
