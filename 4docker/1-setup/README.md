# Lab 4: Getting Started with Docker: Deploying a Basic Web App

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Learning Objectives](#learning-objectives)
  - [Note](#note)
- [Task 1 - Prepare Virtual Machine on UiS Cloud](#task-1---prepare-virtual-machine-on-uis-cloud)
- [Task 2 - Install Docker on Ubuntu](#task-2---install-docker-on-ubuntu)
- [Task 3 - Verification and Cleanup](#task-3---verification-and-cleanup)
- [Troubleshooting](#troubleshooting)
  - [Common Issues](#common-issues)
- [Next Steps](#next-steps)
- [Additional Resources](#additional-resources)

## Learning Objectives

- **Duration:** ~60 minutes
- **Prerequisites:** Access to UiS campus network

By the end of this lab, you will be able to:

- Set up and configure a virtual machine on UiS Cloud (OpenStack)
- Configure networking, security groups, and SSH access
- Install and configure Docker on Ubuntu
- Verify your Docker installation

### Note

You may skip the setup portion of this lab and complete the docker lab on your own machine as well.
The easiest way to do this is to install Docker Desktop, which includes everything you need to get started.
[Docker Desktop](https://www.docker.com/products/docker-desktop/) is available for Windows (WSL2), macOS, and Linux.
Make sure you configure Docker Desktop to have enough resources, such as memory and processors.

To take this option, proceed to [Part 2: Docker Basics](../2-basics/README.md) to start learning Docker fundamentals.

## Task 1 - Prepare Virtual Machine on UiS Cloud

**Note that certain parts of this lab require UiS campus network access.**

1. **Login to UiS's OpenStack**

   Login to [cloud.cs.ux.uis.no/horizon](https://cloud.cs.ux.uis.no/horizon) using your GitHub username as both the username and password.

2. **Network**

   Use existing network in your project called dat515-network.

3. **Security Configuration:**

   **Manage Security Group Rules:**

   - Navigate to `Project->Network->Security Groups`
   - Select Manage Rules, and click `+ Add Rule`
   - Select SSH from the Rule dropdown menu
   - In the CIDR field, enter the IP address from where you want to connect
     For example, to grant access to the whole university network: `152.94.0.0/16`
   - Click Add

4. **SSH Key Management**

   **Option 1 - Import Existing SSH Key**

   - Navigate to `Project->Compute->Key Pairs`
   - This assumes you have already generated an SSH key pair on your local machine
   - Reference: [Generate SSH keys](https://romanzolotarev.com/ssh.html)
   - Click `+ Import Public Key`
   - Enter Key Pair Name
   - Select SSH Key from the Key Type dropdown menu
   - Choose File or Paste your SSH public key in the Public Key field
   - Click Import Public Key

   **Option 2 - Create New Key Pair**

   - Navigate to `Project->Compute->Key Pairs`
   - Click `+ Create Key Pair`
   - Enter Key Pair Name
   - Select SSH Key from the Key Type dropdown menu
   - Click Create Key Pair
   - This will download the private key file; move this to your `.ssh` directory

5. **Create Virtual Machine Instance**

   - Navigate to `Project->Compute->Instances`
   - Click Launch Instance
   - Enter Instance Name
   - **Source:** Pick a VM Image (e.g., Ubuntu 24.04) from Available section
   - **Flavor:** Pick a Flavor (e.g., m1.large) from Available section
   - **Key Pair:** Pick the Key Pair you created or imported earlier
   - **Networks and Security Groups:** Should be configured correctly from previous steps
   - Click Launch Instance

6. **Network Access Configuration - Associate Floating IP**

   - Still on the `Project->Compute->Instances` page
   - Floating IP (public IPv4) is required for external access
   - Click the Down arrow on the right side of the Create Snapshot button
   - Select Associate Floating IP from the dropdown menu
   - Click the + button to create a new floating IP Address (first time only)
   - Click Allocate IP
   - Click Associate

7. **Connect via SSH**

   **Important Network Requirements:**

   - **Direct Connection (UiS Campus Network Required):** If you are physically on campus , you can connect directly to your VM's floating IP
   - **Remote Connection (Use Jump VM):** If you are off-campus, you must use the provided jump VM to access your instance

   **Option A - Direct Connection (On UiS Campus Network):**

   ```console
   ssh ubuntu@floating_ip -i ssh_key
   ```

   **Option B - Remote Connection via Jump VM (Off-Campus):**

   First, connect to the jump VM:

   ```console
   ssh github_username@sshvm.cs.ux.uis.no
   ```

   Then from the jump VM, connect to your instance using private ip:

   ```console
   ssh ubuntu@private_ip -i ssh_key
   ```

   **Alternative - SSH Tunneling (Advanced):**

   You can also set up SSH tunneling through the jump host:

   ```console
   ssh -J github_username@sshvm.cs.ux.uis.no ubuntu@floating_ip -i ssh_key
   ```

   **Network Access Summary:**

   - **On UiS Campus:** Direct connection to floating IP works
   - **Off-Campus :** Must use jump VM or SSH tunneling

   **Note:** The floating IP is only accessible from UiS network ranges. External access requires going through the jump host.

## Task 2 - Install Docker on Ubuntu

1. **Update System Packages**

   ```console
   sudo apt update
   sudo apt upgrade
   sudo reboot # only needed if the kernel was updated
   ```

   After a reboot, log in again using SSH.

2. **Install Docker**

   ```console
   sudo apt install docker.io
   ```

3. **Configure User Permissions**

   ```console
   sudo usermod -aG docker ${USER}
   ```

   Log out and log back in for the group changes to take effect.

4. **Verify Group Membership**

   ```console
   $ groups
   ubuntu adm sudo dip lxd docker
   ```

   If docker is not shown, reboot the VM.

5. **Docker Service Management - Check Docker Status**

   ```console
   sudo systemctl status docker
   ```

   **Enable Docker if needed**

   ```console
   sudo systemctl enable docker
   sudo systemctl start docker
   ```

6. **Configure Docker for OpenStack (MTU Fix)**

   OpenStack VMs use overlay networks with reduced MTU. Configure Docker to match:

   ```console
   # Check your network interface MTU
   ip address
   
   # Create Docker daemon configuration
   echo '{"mtu": 1450}' | sudo tee /etc/docker/daemon.json > /dev/null

   # Restart Docker to apply changes
   sudo systemctl restart docker
   ```

   **Verify MTU Configuration:**

   ```console
   # Check Docker bridge MTU
   ip address show docker0
   ```

   Both should show MTU 1450 to match your OpenStack network.

7. **Verify Installation**

   ```console
   $ docker --version
   Docker version 24.0.7, build 24.0.7-0ubuntu4
   ```

   **Test Docker**

   ```console
   docker run hello-world
   ```

   This should download and run a test container.

## Task 3 - Verification and Cleanup

1. **Check System Information**

   ```console
   docker system info
   docker system df
   ```

   **Verify Network Connectivity**

   ```console
   curl -I https://hub.docker.com
   ```

2. **Optional Cleanup: Remove Test Container**

   ```console
   docker container prune
   docker image prune
   ```

## Troubleshooting

### Common Issues

#### SSH Connection Failed

- Verify you're on UiS campus network
- Check floating IP is correctly associated
- Verify SSH key permissions: `chmod 600 ~/.ssh/your_key`

#### Docker Permission Denied

- Ensure user is in docker group: `groups`
- Log out and back in after adding to group
- Restart if necessary

#### Network Issues

- Verify security group rules include your IP range
- Check router and network interface configuration
- Confirm DNS settings (8.8.8.8)

## Next Steps

Once you have successfully completed this lab:

1. VM is running and accessible via SSH
2. Docker is installed and working
3. Docker MTU is configured for OpenStack compatibility
4. Network and security are configured
5. Test container runs successfully

Proceed to [Part 2: Docker Basics](../2-basics/README.md) to start learning Docker fundamentals.

## Additional Resources

- [OpenStack Documentation](https://docs.openstack.org/)
- [Docker Installation Guide](https://docs.docker.com/engine/install/ubuntu/)
- [SSH Key Generation Guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)
