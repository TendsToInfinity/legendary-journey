EC2_ALLOWED_INGRESS_CIDRS:
  - ports:
      from: 22
      to: 22
    cidrIp: 10.255.104.0/22
    description: Allow Midway VPN users
  - ports:
      from: 22
      to: 22
    cidrIp: 10.254.60.0/22
    description: Allow Atlanta VPN users

EC2_ALLOWED_SECONDARY_INGRESS_CIDRS:
  - ports:
      from: 22
      to: 22
    cidrIp: 10.255.104.0/22
    description: Allow Midway VPN users
  - ports:
      from: 22
      to: 22
    cidrIp: 10.254.60.0/22
    description: Allow Atlanta VPN users
