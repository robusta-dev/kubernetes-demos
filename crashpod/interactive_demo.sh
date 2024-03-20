#!/bin/sh
echo "Deploying a healthy Deployment"
kubectl apply -f ./healthy.yaml 

read -p "Press enter to break the Deployment..."
kubectl apply -f ./broken.yaml

echo "\nWaiting 60 seconds"
sleep 60
echo "Done waiting. Check your Slack channel and the Robusta UI"

read -p "Press enter to cleanup..."
kubectl delete deployment payment-processing-worker
